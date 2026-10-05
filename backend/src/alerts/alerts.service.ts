import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common";
import { assertSafeId } from "../security/sql-ids";
import * as fs from "fs";
import * as os from "os";
import { PrismaService } from "../prisma/prisma.service";
import { IngestService } from "../ingest/ingest.service";
import { LiveViewTracker } from "../stats/live-view-tracker";
import { MailService } from "../mail/mail.service";
import { isAdminRole } from "../auth/roles";
import { getHlsPlaylistFile } from "../streaming/hls-paths";
import { evaluateAlerts, type TrendPoint } from "./alert-rules";
import { AlertsGateway } from "./alerts.gateway";

type Authed = { id: string; email?: string; role?: string };

@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AlertsService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private trend = new Map<string, TrendPoint[]>();
    private viewerTrail = new Map<string, { t: number; n: number }[]>();
    private prevCpu = process.cpuUsage();
    private prevCpuAt = Date.now();

    constructor(
        private readonly prisma: PrismaService,
        private readonly ingest: IngestService,
        private readonly live: LiveViewTracker,
        private readonly mail: MailService,
        private readonly gateway: AlertsGateway,
    ) {}

    private get alerts() {
        return (this.prisma as any).streamAlert;
    }
    private get prefs() {
        return (this.prisma as any).streamAlertPref;
    }

    onModuleInit() {
        this.timer = setInterval(() => {
            this.tick().catch((err) => this.logger.warn(`Alert tick: ${err?.message || err}`));
        }, 15_000);
        setTimeout(() => this.tick().catch(() => undefined), 4000);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    async list(user: Authed, query: { showId?: string; status?: string; severity?: string }) {
        const showId = String(query.showId || "").trim();
        if (showId) await this.requireShow(user, showId);
        else await this.requireStreamerOrAdmin(user);
        const where: any = {};
        if (showId) where.showId = showId;
        else if (!isAdminRole(user)) {
            const shows = await this.ownedShowIds(user.id);
            where.showId = { in: shows };
        }
        const status = String(query.status || "").toLowerCase();
        if (status === "active") where.resolvedAt = null;
        if (status === "resolved") where.resolvedAt = { not: null };
        const severity = String(query.severity || "").toLowerCase();
        if (severity === "warning" || severity === "critical" || severity === "info") where.severity = severity;
        const rows = await this.alerts.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 200,
        });
        return { alerts: rows.map((r: any) => this.serialize(r)) };
    }

    async dismiss(user: Authed, id: string) {
        const row = await this.requireAlert(user, id);
        const updated = await this.alerts.update({
            where: { id: row.id },
            data: { resolvedAt: new Date(), snoozedUntil: null },
        });
        this.gateway.emitAlert(updated.showId || updated.streamId, { action: "dismiss", alert: this.serialize(updated) });
        return { alert: this.serialize(updated) };
    }

    async remove(user: Authed, id: string) {
        const row = await this.requireAlert(user, id);
        if (!row.resolvedAt) {
            throw new BadRequestException("Csak a megtekintett, lezárt riasztás törölhető.");
        }
        await this.alerts.delete({ where: { id: row.id } });
        this.gateway.emitAlert(row.showId || row.streamId, { action: "deleted", alert: { id: row.id } });
        return { ok: true, id: row.id };
    }

    async removeResolved(user: Authed, showId?: string) {
        const id = String(showId || "").trim();
        const where: { showId: string | { in: string[] }; resolvedAt: { not: null } } = {
            resolvedAt: { not: null },
            showId: { in: [] },
        };
        if (id) {
            assertSafeId(id, "műsor");
            await this.requireShow(user, id);
            where.showId = id;
        } else {
            await this.requireStreamerOrAdmin(user);
            where.showId = { in: await this.ownedShowIds(user.id) };
        }
        const result = await this.alerts.deleteMany({ where });
        return { ok: true, deleted: result.count };
    }

    async snooze(user: Authed, id: string, minutes = 5) {
        const row = await this.requireAlert(user, id);
        const mins = Math.min(60, Math.max(1, Number(minutes) || 5));
        const updated = await this.alerts.update({
            where: { id: row.id },
            data: { snoozedUntil: new Date(Date.now() + mins * 60_000) },
        });
        this.gateway.emitAlert(updated.showId || updated.streamId, { action: "snooze", alert: this.serialize(updated) });
        return { alert: this.serialize(updated) };
    }

    async getPref(user: Authed) {
        const row = await this.prefs.findUnique({ where: { userId: user.id } });
        return {
            emailEnabled: Boolean(row?.emailEnabled),
            pushEnabled: row?.pushEnabled !== false,
            discordWebhook: row?.discordWebhook || "",
            telegramChatId: row?.telegramChatId || "",
        };
    }

    async putPref(user: Authed, body: Record<string, unknown>) {
        const data = {
            emailEnabled: Boolean(body.emailEnabled),
            pushEnabled: body.pushEnabled !== false,
            discordWebhook: String(body.discordWebhook || "").trim() || null,
            telegramChatId: String(body.telegramChatId || "").trim() || null,
        };
        const row = await this.prefs.upsert({
            where: { userId: user.id },
            create: { userId: user.id, ...data },
            update: data,
        });
        return {
            emailEnabled: row.emailEnabled,
            pushEnabled: row.pushEnabled,
            discordWebhook: row.discordWebhook || "",
            telegramChatId: row.telegramChatId || "",
        };
    }

    private serialize(row: any) {
        const snoozed = row.snoozedUntil && new Date(row.snoozedUntil).getTime() > Date.now();
        return {
            id: row.id,
            streamId: row.streamId,
            showId: row.showId,
            severity: row.severity,
            type: row.type,
            title: row.title,
            message: row.message,
            recommendation: row.recommendation,
            createdAt: row.createdAt,
            resolvedAt: row.resolvedAt,
            snoozedUntil: row.snoozedUntil,
            active: !row.resolvedAt && !snoozed,
        };
    }

    private async tick() {
        const shows = await this.prisma.show.findMany({
            where: { live: true },
            select: { id: true, streamId: true, live: true, streamer: { select: { userId: true, contactEmail: true, email: true } } },
        });
        const cpuPct = this.sampleCpu();
        const ramPct = os.totalmem() ? (1 - os.freemem() / os.totalmem()) * 100 : 0;
        const t0 = Date.now();
        await this.prisma.$queryRaw`SELECT 1`.catch(() => undefined);
        const dbLatencyMs = Date.now() - t0;

        for (const show of shows) {
            const streamId = String(show.streamId || show.id);
            const ingestAlive = this.ingest.listActiveStreamIds().includes(streamId);
            const enc = this.ingest.getEncoderHealth(streamId);
            const playlist = getHlsPlaylistFile(streamId);
            let hlsAgeMs: number | undefined;
            try {
                if (fs.existsSync(playlist)) hlsAgeMs = Date.now() - fs.statSync(playlist).mtimeMs;
            } catch {
                hlsAgeMs = undefined;
            }
            const viewers = this.live.byShow().get(show.id) || this.live.byShow().get(streamId) || 0;
            this.pushTrail(this.viewerTrail, show.id, viewers);
            const viewersAgo5m = this.valueAgo(this.viewerTrail.get(show.id) || [], 5 * 60_000);
            const chatLastMin = await this.countChat(show.id, 60_000);
            const chatPrevMin = await this.countChat(show.id, 120_000, 60_000);
            const ticketsLast5m = await this.countTickets(show.id, 5 * 60_000);
            const ticketsPrev5m = await this.countTickets(show.id, 10 * 60_000, 5 * 60_000);
            const q = await this.topDuplicateQuestion(show.id);
            this.pushTrailPoints(show.id, cpuPct, viewers);
            const sample = {
                showId: show.id,
                streamId,
                ingestAlive,
                showLive: true,
                fps: enc?.fps,
                bitrateKbps: enc?.bitrateKbps,
                dropped: enc?.dropped,
                speed: enc?.speed,
                encoderStall: Boolean(enc?.stall),
                hlsAgeMs,
                viewers,
                viewersAgo5m,
                chatLastMin,
                chatPrevMin,
                ticketsLast5m,
                ticketsPrev5m,
                duplicateQuestions: q.count,
                topQuestion: q.text,
                cpuPct,
                ramPct,
                dbLatencyMs,
            };
            const drafts = evaluateAlerts(sample, this.trend.get(show.id) || []);
            for (const draft of drafts) {
                await this.raise(show, draft);
            }
        }
    }

    private async raise(
        show: { id: string; streamId: string | null; streamer: { userId: string | null; contactEmail: string; email: string } | null },
        draft: ReturnType<typeof evaluateAlerts>[number],
    ) {
        const streamId = String(show.streamId || show.id);
        const existing = await this.alerts.findFirst({
            where: { showId: show.id, type: draft.type, resolvedAt: null },
            orderBy: { createdAt: "desc" },
        });
        if (existing) {
            const snoozed = existing.snoozedUntil && new Date(existing.snoozedUntil).getTime() > Date.now();
            const age = Date.now() - new Date(existing.createdAt).getTime();
            if (snoozed || age < 8 * 60_000) return;
        }
        const row = await this.alerts.create({
            data: {
                streamId,
                showId: show.id,
                severity: draft.severity,
                type: draft.type,
                title: draft.title,
                message: draft.message,
                recommendation: draft.recommendation,
            },
        });
        const payload = { action: "new", alert: this.serialize(row) };
        this.gateway.emitAlert(show.id, payload);
        void this.notify(show, row).catch(() => undefined);
    }

    private async notify(show: { streamer: { userId: string | null; contactEmail: string; email: string } | null }, row: any) {
        const userId = show.streamer?.userId;
        if (!userId) return;
        const pref = await this.prefs.findUnique({ where: { userId } }).catch(() => null);
        if (pref?.emailEnabled) {
            const to = show.streamer?.contactEmail || show.streamer?.email;
            if (to) {
                await this.mail.safetyAlert(to, row.title, `${row.message}\n\n${row.recommendation}`);
            }
        }
        const hook = pref?.discordWebhook || process.env.ALERT_DISCORD_WEBHOOK || "";
        if (hook) {
            await fetch(hook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: `**${row.title}**\n${row.message}\n_${row.recommendation}_` }),
            }).catch(() => undefined);
        }
        const chat = pref?.telegramChatId || process.env.ALERT_TELEGRAM_CHAT_ID || "";
        const token = process.env.ALERT_TELEGRAM_BOT_TOKEN || "";
        if (chat && token) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chat, text: `${row.title}\n${row.message}\n${row.recommendation}` }),
            }).catch(() => undefined);
        }
    }

    private sampleCpu() {
        const cores = os.cpus().length || 1;
        const load = os.loadavg()[0];
        if (process.platform !== "win32" && load > 0) {
            return Math.min(100, (load / cores) * 100);
        }
        const now = Date.now();
        const usage = process.cpuUsage(this.prevCpu);
        const elapsed = Math.max(1, now - this.prevCpuAt);
        this.prevCpu = process.cpuUsage();
        this.prevCpuAt = now;
        return Math.min(100, ((usage.user + usage.system) / 1000 / elapsed / cores) * 100);
    }

    private pushTrail(map: Map<string, { t: number; n: number }[]>, id: string, n: number) {
        const arr = map.get(id) || [];
        arr.push({ t: Date.now(), n });
        map.set(id, arr.filter((p) => Date.now() - p.t < 12 * 60_000));
    }

    private valueAgo(arr: { t: number; n: number }[], ms: number) {
        const target = Date.now() - ms;
        let best: { t: number; n: number } | undefined;
        for (const p of arr) {
            if (p.t <= target && (!best || p.t > best.t)) best = p;
        }
        return best?.n;
    }

    private pushTrailPoints(showId: string, cpu: number, viewers: number) {
        const arr = this.trend.get(showId) || [];
        arr.push({ t: Date.now(), cpu, viewers });
        this.trend.set(showId, arr.filter((p) => Date.now() - p.t < 12 * 60_000));
    }

    private async countChat(showId: string, withinMs: number, afterMs = 0) {
        const to = new Date(Date.now() - afterMs);
        const from = new Date(Date.now() - withinMs);
        try {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS count
                FROM "ChatMessage"
                WHERE "showId" = ${showId}
                  AND "createdAt" >= ${from}
                  AND "createdAt" < ${to}
                  AND COALESCE(status, 'approved') = 'approved'
            `;
            return rows[0]?.count || 0;
        } catch {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS count
                FROM "ChatMessage"
                WHERE "showId" = ${showId}
                  AND "createdAt" >= ${from}
                  AND "createdAt" < ${to}
            `.catch(() => [{ count: 0 }]);
            return rows[0]?.count || 0;
        }
    }

    private async countTickets(showId: string, withinMs: number, afterMs = 0) {
        const to = new Date(Date.now() - afterMs);
        const from = new Date(Date.now() - withinMs);
        return this.prisma.ticket.count({
            where: { showId, createdAt: { gte: from, lt: to } },
        });
    }

    private async topDuplicateQuestion(showId: string) {
        const since = new Date(Date.now() - 15 * 60_000);
        const rows = await this.prisma.question.findMany({
            where: { showId, createdAt: { gte: since } },
            select: { text: true },
            take: 80,
        });
        const map = new Map<string, { n: number; text: string }>();
        for (const row of rows) {
            const key = String(row.text || "").trim().toLowerCase().slice(0, 80);
            if (key.length < 8) continue;
            const cur = map.get(key) || { n: 0, text: row.text };
            cur.n += 1;
            map.set(key, cur);
        }
        let best = { n: 0, text: "" };
        for (const v of map.values()) if (v.n > best.n) best = v;
        return { count: best.n, text: best.text };
    }

    private async requireShow(user: Authed, showId: string) {
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            include: { streamer: true },
        });
        if (!show) throw new NotFoundException("A műsor nem található.");
        if (isAdminRole(user)) return show;
        if (show.streamer?.userId !== user.id) {
            throw new ForbiddenException("Nincs jogosultság a riasztásokhoz.");
        }
        return show;
    }

    private async requireAlert(user: Authed, id: string) {
        assertSafeId(id, "riasztás");
        const row = await this.alerts.findUnique({ where: { id } });
        if (!row) throw new NotFoundException("A riasztás nem található.");
        if (row.showId) await this.requireShow(user, row.showId);
        else await this.requireStreamerOrAdmin(user);
        return row;
    }

    private async requireStreamerOrAdmin(user: Authed) {
        if (isAdminRole(user)) return;
        const streamer = await this.prisma.streamer.findFirst({ where: { userId: user.id } });
        if (!streamer) throw new ForbiddenException("Nincs jogosultság a riasztásokhoz.");
    }

    private async ownedShowIds(userId: string) {
        const streamer = await this.prisma.streamer.findFirst({ where: { userId } });
        if (!streamer) return [];
        const shows = await this.prisma.show.findMany({ where: { streamerId: streamer.id }, select: { id: true } });
        return shows.map((s) => s.id);
    }
}

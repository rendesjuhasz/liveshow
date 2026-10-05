import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LiveViewTracker } from "../stats/live-view-tracker";
import { MarketingService } from "./marketing.service";
import { cutMarketingClip } from "./clip-ffmpeg";
import { rankTopClips, spikeScore, type ActivitySample } from "./clip-score";
import {
    ensureMarketingAutoSchema,
    loadSettingsRow,
    parseSettingsPatch,
    saveSettingsRow,
    type MarketingSettingsRow,
} from "./marketing-settings";
import { USER_ROLES } from "../auth/roles";
import { assertSafeId } from "../security/sql-ids";

type Sample = ActivitySample & { at: number };

@Injectable()
export class MarketingAutoService {
    private readonly logger = new Logger(MarketingAutoService.name);
    private trail = new Map<string, Sample[]>();
    private liveSince = new Map<string, number>();
    private lastClipAt = new Map<string, number>();
    private busy = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly live: LiveViewTracker,
        private readonly kits: MarketingService,
    ) {}

    async ensure() {
        await ensureMarketingAutoSchema(this.prisma);
    }

    async getSettings(): Promise<MarketingSettingsRow> {
        await this.ensure();
        return loadSettingsRow(this.prisma);
    }

    async putSettings(body: Record<string, unknown>) {
        await this.ensure();
        return saveSettingsRow(this.prisma, parseSettingsPatch(body));
    }

    async overview() {
        await this.ensure();
        const settings = await this.getSettings();
        const clips = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "StreamClip" ORDER BY "createdAt" DESC LIMIT 40
        `.catch(() => []);
        const jobs = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MarketingJob" ORDER BY "createdAt" DESC LIMIT 40
        `.catch(() => []);
        const accounts = await this.prisma.$queryRaw<{ provider: string; n: number }[]>`
            SELECT provider, COUNT(*)::int AS n FROM "SocialAccount" GROUP BY provider
        `.catch(() => []);
        const regs = await this.prisma.user.count().catch(() => 0);
        const tickets = await this.prisma.ticket.count({ where: { status: "paid" } }).catch(() => 0);
        return {
            settings,
            clips,
            jobs,
            connections: {
                facebook: accounts.some((a) => a.provider === "facebook"),
                linkedin: accounts.some((a) => a.provider === "linkedin"),
                x: accounts.some((a) => a.provider === "x"),
                tiktok: false,
                instagram: false,
                youtube: false,
            },
            stats: {
                tiktokViews: 0,
                tiktokClicks: 0,
                facebookViews: 0,
                facebookClicks: 0,
                instagramReach: 0,
                instagramInteractions: 0,
                youtubeShortsViews: 0,
                youtubeClicks: 0,
                registrations: regs,
                ticketPurchases: tickets,
                conversions: tickets,
                note: "A közösségi megtekintés/kattintás a platform API-kulcsok után töltődik. Élő adásban nincs reklám overlay.",
            },
        };
    }

    async tick() {
        if (this.busy) return;
        this.busy = true;
        try {
            await this.ensure();
            const settings = await this.getSettings();
            if (settings.clipEnabled) await this.detectLive(settings);
            await this.cutPending(settings);
            await this.finalizeEndedShows(settings);
            await this.processJobs(settings);
        } catch (err: any) {
            this.logger.warn(`Marketing auto: ${err?.message || err}`);
        } finally {
            this.busy = false;
        }
    }

    private async detectLive(settings: MarketingSettingsRow) {
        const shows = await this.prisma.show.findMany({
            where: { live: true },
            select: { id: true, streamId: true },
        });
        const viewers = this.live.byShow();
        const now = Date.now();
        for (const show of shows) {
            if (!this.liveSince.has(show.id)) this.liveSince.set(show.id, now);
            const streamId = String(show.streamId || show.id);
            const sample: Sample = {
                at: now,
                viewers: viewers.get(show.id) || viewers.get(streamId) || 0,
                chat: await this.countSince(show.id, "ChatMessage", 60_000),
                questions: await this.countSince(show.id, "Question", 60_000),
                support: await this.countSince(show.id, "ShowSupport", 60_000),
            };
            const trail = this.trail.get(show.id) || [];
            trail.push(sample);
            this.trail.set(
                show.id,
                trail.filter((s) => now - s.at < 10 * 60_000),
            );
            const avg = this.average(trail.filter((s) => now - s.at > 30_000));
            const spike = spikeScore(sample, avg);
            if (spike.score < 1.2) continue;
            const last = this.lastClipAt.get(show.id) || 0;
            if (now - last < 90_000) continue;
            const offsetSec = Math.max(0, Math.floor((now - (this.liveSince.get(show.id) || now)) / 1000) - 8);
            const clipId = randomUUID();
            await this.prisma.$executeRaw`
                INSERT INTO "StreamClip"
                    (id, "showId", "streamId", "offsetSec", "durationSec", score, reason, viewers, "chatCount", "questionCount", "supportCount", status)
                VALUES
                    (${clipId}, ${show.id}, ${streamId}, ${offsetSec}, ${settings.clipLengthSec}, ${spike.score}, ${spike.reason}, ${sample.viewers}, ${sample.chat}, ${sample.questions}, ${sample.support}, 'pending')
            `;
            this.lastClipAt.set(show.id, now);
        }
        for (const id of [...this.liveSince.keys()]) {
            if (!shows.some((s) => s.id === id)) this.liveSince.delete(id);
        }
    }

    private average(rows: ActivitySample[]): ActivitySample {
        if (!rows.length) return { viewers: 1, chat: 1, questions: 0, support: 0 };
        const n = rows.length;
        return {
            viewers: rows.reduce((s, r) => s + r.viewers, 0) / n,
            chat: rows.reduce((s, r) => s + r.chat, 0) / n,
            questions: rows.reduce((s, r) => s + r.questions, 0) / n,
            support: rows.reduce((s, r) => s + r.support, 0) / n,
        };
    }

    private async countSince(showId: string, table: "ChatMessage" | "Question" | "ShowSupport", withinMs: number) {
        const since = new Date(Date.now() - withinMs);
        let rows: { n: number }[] = [];
        if (table === "ChatMessage") {
            rows = await this.prisma.$queryRaw<{ n: number }[]>`
                SELECT COUNT(*)::int AS n FROM "ChatMessage" WHERE "showId" = ${showId} AND "createdAt" >= ${since}
            `.catch(() => [{ n: 0 }]);
        } else if (table === "Question") {
            rows = await this.prisma.$queryRaw<{ n: number }[]>`
                SELECT COUNT(*)::int AS n FROM "Question" WHERE "showId" = ${showId} AND "createdAt" >= ${since}
            `.catch(() => [{ n: 0 }]);
        } else {
            rows = await this.prisma.$queryRaw<{ n: number }[]>`
                SELECT COUNT(*)::int AS n FROM "ShowSupport" WHERE "showId" = ${showId} AND "createdAt" >= ${since}
            `.catch(() => [{ n: 0 }]);
        }
        return Number(rows[0]?.n || 0);
    }

    private async cutPending(settings: MarketingSettingsRow) {
        const pending = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "StreamClip" WHERE status = 'pending' ORDER BY "createdAt" ASC LIMIT 4
        `.catch(() => []);
        for (const clip of pending) {
            await this.prisma.$executeRaw`UPDATE "StreamClip" SET status = 'cutting' WHERE id = ${clip.id}`;
            try {
                const files = await cutMarketingClip({
                    streamId: clip.streamId,
                    clipId: clip.id,
                    offsetSec: clip.offsetSec,
                    durationSec: clip.durationSec || settings.clipLengthSec,
                });
                await this.prisma.$executeRaw`
                    UPDATE "StreamClip"
                    SET status = 'ready',
                        "filePath" = ${files.filePath},
                        "verticalPath" = ${files.verticalPath},
                        "publicPath" = ${files.publicPath},
                        "lastError" = NULL
                    WHERE id = ${clip.id}
                `;
            } catch (err: any) {
                const message = String(err?.message || err).slice(0, 400);
                await this.prisma.$executeRaw`
                    UPDATE "StreamClip" SET status = 'failed', "lastError" = ${message} WHERE id = ${clip.id}
                `;
            }
        }
    }

    private async finalizeEndedShows(settings: MarketingSettingsRow) {
        const shows = await this.prisma.show.findMany({
            where: { live: false, status: "archived", updatedAt: { gte: new Date(Date.now() - 2 * 24 * 3600_000) } },
            select: { id: true, streamId: true, streamerId: true, title: true, startTime: true },
            take: 8,
        });
        for (const show of shows) {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT * FROM "StreamClip" WHERE "showId" = ${show.id}
            `.catch(() => []);
            type ClipRow = { id: string; status: string; score: number; createdAt: Date };
            const ready = (rows as ClipRow[]).filter(
                (r) => r.status === "ready" || r.status === "pending" || r.status === "cutting",
            );
            const ranked = rankTopClips(ready, 5);
            for (const row of ranked) {
                await this.prisma.$executeRaw`
                    UPDATE "StreamClip" SET rank = ${row.rank} WHERE id = ${row.id}
                `;
            }
            await this.enqueueSocial(show, settings, ranked);
            if (settings.autoKitEnabled) await this.enqueueKit(show.id);
            if (settings.nextShowPromoEnabled) await this.enqueueNextShow(show);
        }
    }

    private async enqueueSocial(show: { id: string }, settings: MarketingSettingsRow, ranked: { id: string; rank: number }[]) {
        const top = ranked.filter((r) => r.rank && r.rank <= 5);
        const channels: { on: boolean; channel: string; max: number; approval: boolean }[] = [
            {
                on: settings.tiktokEnabled,
                channel: "tiktok",
                max: settings.tiktokMaxPerDay,
                approval: true,
            },
            {
                on: settings.facebookReelsEnabled,
                channel: "facebook_reels",
                max: settings.facebookMaxPerDay,
                approval: settings.facebookManualApproval && !settings.facebookAutoPublish,
            },
            { on: settings.instagramEnabled, channel: "instagram", max: 3, approval: true },
            { on: settings.youtubeShortsEnabled, channel: "youtube_shorts", max: 5, approval: true },
        ];
        for (const ch of channels) {
            if (!ch.on) continue;
            for (const clip of top.slice(0, ch.max)) {
                await this.enqueueJob({
                    showId: show.id,
                    clipId: clip.id,
                    type: "social",
                    channel: ch.channel,
                    status: ch.approval ? "needs_approval" : "pending",
                    dedupeKey: `social:${ch.channel}:${clip.id}`,
                    payload: { rank: clip.rank },
                });
            }
        }
    }

    private async enqueueKit(showId: string) {
        await this.enqueueJob({
            showId,
            type: "kit",
            channel: "openai",
            status: "pending",
            dedupeKey: `kit:${showId}`,
        });
    }

    private async enqueueNextShow(ended: { id: string; streamerId: string | null; title: string }) {
        if (!ended.streamerId) return;
        const next = await this.prisma.show.findFirst({
            where: {
                streamerId: ended.streamerId,
                id: { not: ended.id },
                status: "active",
                startTime: { gt: new Date() },
            },
            orderBy: { startTime: "asc" },
        });
        if (!next) return;
        await this.enqueueJob({
            showId: next.id,
            type: "next_show",
            channel: "facebook",
            status: "pending",
            dedupeKey: `next:${ended.id}:${next.id}`,
            payload: {
                fromShowId: ended.id,
                fromTitle: ended.title,
                nextTitle: next.title,
                startTime: next.startTime,
            },
        });
    }

    private async enqueueJob(data: {
        showId?: string;
        clipId?: string;
        type: string;
        channel: string;
        status: string;
        dedupeKey: string;
        payload?: unknown;
    }) {
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "MarketingJob" WHERE "dedupeKey" = ${data.dedupeKey} LIMIT 1
        `.catch(() => []);
        if (existing[0]) return existing[0];
        const id = randomUUID();
        const payload = JSON.stringify(data.payload ?? null);
        await this.prisma.$executeRaw`
            INSERT INTO "MarketingJob" (id, "showId", "clipId", type, channel, status, "dedupeKey", payload)
            VALUES (
                ${id},
                ${data.showId || null},
                ${data.clipId || null},
                ${data.type},
                ${data.channel},
                ${data.status},
                ${data.dedupeKey},
                CAST(${payload} AS JSONB)
            )
        `;
        return { id };
    }

    private async processJobs(settings: MarketingSettingsRow) {
        const due = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MarketingJob" WHERE status = 'pending' ORDER BY "createdAt" ASC LIMIT 6
        `.catch(() => []);
        for (const job of due) {
            await this.prisma.$executeRaw`UPDATE "MarketingJob" SET status = 'running' WHERE id = ${job.id}`;
            try {
                if (job.type === "kit") {
                    const admin = await this.systemUser();
                    if (admin && job.showId) {
                        await this.kits.generate(admin, job.showId, "hu");
                    }
                    await this.prisma.$executeRaw`
                        UPDATE "MarketingJob" SET status = 'published', "ranAt" = NOW(), "lastError" = NULL WHERE id = ${job.id}
                    `;
                    continue;
                }
                if (job.type === "next_show") {
                    const copy = this.nextShowCopy(job.payload);
                    await this.prisma.$executeRaw`
                        UPDATE "MarketingJob" SET status = 'published', "ranAt" = NOW(), "lastError" = ${copy} WHERE id = ${job.id}
                    `;
                    continue;
                }
                if (job.type === "social") {
                    const status =
                        job.channel === "facebook_reels" &&
                        settings.facebookAutoPublish &&
                        !settings.facebookManualApproval
                            ? "skipped"
                            : "needs_approval";
                    const err =
                        "Nincs TikTok/Instagram/YouTube feltöltő kulcs. A klip kész, az admin jóváhagyás után megy ki, ha a fiók csatlakozik.";
                    await this.prisma.$executeRaw`
                        UPDATE "MarketingJob"
                        SET status = ${status}, "ranAt" = NOW(), "lastError" = ${err}
                        WHERE id = ${job.id}
                    `;
                    continue;
                }
                await this.prisma.$executeRaw`
                    UPDATE "MarketingJob" SET status = 'skipped', "ranAt" = NOW() WHERE id = ${job.id}
                `;
            } catch (err: any) {
                const message = String(err?.message || err).slice(0, 400);
                await this.prisma.$executeRaw`
                    UPDATE "MarketingJob" SET status = 'failed', "lastError" = ${message}, "ranAt" = NOW() WHERE id = ${job.id}
                `;
            }
        }
    }

    private nextShowCopy(payload: unknown) {
        const p = (payload || {}) as { nextTitle?: string; startTime?: string };
        const when = p.startTime ? new Date(p.startTime).toLocaleString("hu-HU") : "";
        return `Következő élő adás: ${p.nextTitle || ""}\n${when}\nCsatlakozz a következő adáshoz!`;
    }

    private async systemUser() {
        return this.prisma.user.findFirst({
            where: { role: USER_ROLES.ADMIN },
            select: { id: true, email: true, role: true },
        });
    }

    async clipFilePath(id: string) {
        await this.ensure();
        assertSafeId(id, "klip");
        const row = await this.prisma.$queryRaw<any[]>`
            SELECT "verticalPath", "filePath" FROM "StreamClip" WHERE id = ${id} LIMIT 1
        `.catch(() => []);
        return row[0]?.verticalPath || row[0]?.filePath || "";
    }

    async setJobStatus(id: string, status: "pending" | "needs_approval" | "skipped") {
        await this.ensure();
        assertSafeId(id, "feladat");
        await this.prisma.$executeRaw`UPDATE "MarketingJob" SET status = ${status} WHERE id = ${id}`;
        return { id, status };
    }
}

import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { IngestService } from "../ingest/ingest.service";
import { BackupService } from "../backup/backup.service";
import { HLS_OUTPUT_ROOT } from "../streaming/hls-paths";
import {
    livekitHttpUrl,
    livekitKeysConfigured,
    liveVideoBackendDefault,
} from "../livekit/livekit-config";

export type ComponentStatus = "ok" | "error" | "skip";

export type HealthCheck = {
    status: ComponentStatus;
    detail?: string;
    latencyMs?: number;
    freeBytes?: number;
    thresholdBytes?: number;
};

@Injectable()
export class OpsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(OpsService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private dbDown = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private readonly ingest: IngestService,
        private readonly backups: BackupService,
    ) {}

    async onModuleInit() {
        await this.ensureSchema();
        this.timer = setInterval(() => {
            this.probe().catch((err) =>
                this.logger.warn(`Health probe: ${err?.message || err}`),
            );
        }, this.pollMs());
        this.probe().catch(() => undefined);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    live() {
        return {
            status: "ok" as const,
            service: "liveshow-api",
            uptimeSec: Math.round(process.uptime()),
        };
    }

    lan() {
        const ips: string[] = [];
        for (const addrs of Object.values(os.networkInterfaces())) {
            for (const a of addrs || []) {
                const family = String(a.family);
                if ((family === "IPv4" || family === "4") && !a.internal) {
                    ips.push(a.address);
                }
            }
        }
        const preferred = ips.filter((ip) => ip.startsWith("192.168.") || ip.startsWith("10."));
        const list = preferred.length ? preferred : ips;
        const ip = list[0] || "";
        return {
            ips: list,
            viewerLive: ip ? `http://${ip}:3000/live` : "",
            streamerLive: ip ? `http://${ip}:3000/streamer/live` : "",
        };
    }

    async ready() {
        const [db, ffmpeg, storage, disk, smtp, livekit] = await Promise.all([
            this.checkDb(),
            this.checkFfmpeg(),
            this.checkStorageWritable(),
            this.checkDisk(),
            Promise.resolve(this.checkSmtp()),
            this.checkLivekit(),
        ]);
        const required = [db, ffmpeg, storage, disk];
        if (this.requireSmtp()) required.push(smtp);
        if (this.requireLivekit()) required.push(livekit);
        const failed = required.some((c) => c.status === "error");
        const status = failed ? "error" : "ok";
        return {
            status,
            db: db.status === "ok" ? "ok" : "error",
            ffmpeg: ffmpeg.status === "ok" ? "ok" : "error",
            disk: disk.status === "ok" ? "ok" : "error",
            smtp: smtp.status === "error" ? (this.requireSmtp() ? "error" : "skip") : smtp.status,
            livekit: livekit.status,
            storage: storage.status === "ok" ? "ok" : "error",
            checks: { db, ffmpeg, storage, disk, smtp, livekit },
            time: new Date().toISOString(),
            env: process.env.NODE_ENV || "development",
        };
    }

    async uptimeBody() {
        const ready = await this.ready();
        return {
            status: ready.status,
            service: "liveshow-api",
        };
    }

    async dashboard() {
        const [health, backup, streams, events] = await Promise.all([
            this.ready(),
            this.backups.status(),
            this.streamMetrics(),
            this.recentEvents(30),
        ]);
        return {
            health,
            backup,
            email: this.mail.smtpMonitor(),
            streams,
            events,
        };
    }

    async streamMetrics() {
        const ingestIds = this.ingest.listActiveStreamIds();
        const liveShows = await this.prisma.show.findMany({
            where: { live: true },
            select: { id: true, title: true, streamId: true },
        }).catch(() => []);
        const liveRows = await this.prisma.$queryRaw<any[]>`
            SELECT s.id, s.title, s."streamKey", s."isLive", s."liveStartedAt", sh.title AS "showTitle"
            FROM "Stream" s
            LEFT JOIN "Show" sh ON sh.id = s."showId"
            WHERE s."isLive" = true
        `.catch(() => []);
        const now = Date.now();
        const active = liveRows.map((row) => {
            const started = row.liveStartedAt ? new Date(row.liveStartedAt).getTime() : null;
            return {
                streamId: row.streamKey || row.id,
                title: row.showTitle || row.title,
                ingestProcess: ingestIds.includes(String(row.streamKey || "")),
                liveStartedAt: row.liveStartedAt,
                uptimeSec: started ? Math.max(0, Math.round((now - started) / 1000)) : 0,
            };
        });
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const counts = await this.prisma.$queryRaw<any[]>`
            SELECT source, COUNT(*)::int AS n
            FROM "StreamStartError"
            WHERE "createdAt" >= ${since}
            GROUP BY source
        `.catch(() => []);
        const bySource = new Map(counts.map((r) => [String(r.source), Number(r.n) || 0]));
        return {
            activeCount: Math.max(active.length, liveShows.length, ingestIds.length),
            ingestProcesses: ingestIds.length,
            liveShows: liveShows.length,
            failedStarts24h: bySource.get("dashboard") || 0,
            ingestFailures24h: bySource.get("ingest") || 0,
            archiveFailures24h: bySource.get("archive") || 0,
            active,
        };
    }

    async recentEvents(limit = 30) {
        const take = Math.min(100, Math.max(1, Number(limit) || 30));
        return this.prisma.$queryRaw<any[]>`
            SELECT id, kind, service, message, "showId", "streamId", "createdAt"
            FROM "OpsEvent"
            ORDER BY "createdAt" DESC
            LIMIT ${take}
        `.catch(() => []);
    }

    async report(input: {
        kind: string;
        service: string;
        message: string;
        showId?: string | null;
        streamId?: string | null;
        detail?: string | null;
    }) {
        const kind = String(input.kind || "ops").slice(0, 40);
        void this.mail.opsAlert({
            kind,
            service: input.service,
            message: input.message,
            detail: input.detail,
            showId: input.showId,
            streamId: input.streamId,
        });
    }

    private pollMs() {
        const ms = Number(process.env.HEALTH_POLL_MS || 60_000);
        return Number.isFinite(ms) && ms >= 15_000 ? ms : 60_000;
    }

    diskThresholdBytes() {
        const mb = Number(process.env.HEALTH_DISK_MIN_FREE_MB || 512);
        const safe = Number.isFinite(mb) && mb >= 50 ? mb : 512;
        return Math.round(safe * 1024 * 1024);
    }

    requireSmtp() {
        const raw = String(process.env.HEALTH_REQUIRE_SMTP || "").toLowerCase();
        if (raw === "true" || raw === "1") return true;
        if (raw === "false" || raw === "0") return false;
        return process.env.NODE_ENV === "production";
    }

    requireLivekit() {
        if (liveVideoBackendDefault() !== "livekit") return false;
        if (!livekitKeysConfigured() && process.env.NODE_ENV !== "production") return false;
        return true;
    }

    async checkLivekit(): Promise<HealthCheck> {
        const required = this.requireLivekit();
        if (!livekitKeysConfigured()) {
            return required
                ? { status: "error", detail: "LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_PUBLIC_URL hiányzik" }
                : { status: "skip", detail: "LiveKit nincs beállítva" };
        }
        const base = livekitHttpUrl();
        const started = Date.now();
        try {
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), 2500);
            const res = await fetch(`${base}/`, { method: "GET", signal: ac.signal });
            clearTimeout(timer);
            const latencyMs = Date.now() - started;
            if (res.ok || (res.status >= 200 && res.status < 500)) {
                return { status: "ok", latencyMs, detail: `HTTP ${res.status}` };
            }
            const detail = `HTTP ${res.status}`;
            return required
                ? { status: "error", latencyMs, detail }
                : { status: "skip", latencyMs, detail };
        } catch (err: any) {
            const latencyMs = Date.now() - started;
            const detail = err?.name === "AbortError" ? "timeout" : err?.message || "unreachable";
            return required
                ? { status: "error", latencyMs, detail }
                : { status: "skip", latencyMs, detail };
        }
    }

    private async probe() {
        const ready = await this.ready();
        if (ready.db !== "ok") {
            if (!this.dbDown) {
                this.dbDown = true;
                await this.report({
                    kind: "db_down",
                    service: "postgres",
                    message: "Az adatbázis nem elérhető.",
                    detail: ready.checks.db.detail,
                });
            }
        } else {
            this.dbDown = false;
        }
        if (ready.disk !== "ok") {
            await this.report({
                kind: "disk_low",
                service: "disk",
                message: "Kevés a szabad lemezterület.",
                detail: ready.checks.disk.detail,
            });
        }
    }

    private async checkDb(): Promise<HealthCheck> {
        const started = Date.now();
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: "ok", latencyMs: Date.now() - started };
        } catch (err: any) {
            return { status: "error", detail: err?.message || "db", latencyMs: Date.now() - started };
        }
    }

    private checkFfmpeg(): Promise<HealthCheck> {
        return new Promise((resolve) => {
            execFile("ffmpeg", ["-version"], { timeout: 8_000, windowsHide: true }, (err, stdout) => {
                if (err) {
                    resolve({ status: "error", detail: err.message || "ffmpeg missing" });
                    return;
                }
                const line = String(stdout || "").split("\n")[0]?.trim() || "ffmpeg";
                resolve({ status: "ok", detail: line.slice(0, 120) });
            });
        });
    }

    private checkStorageWritable(): HealthCheck {
        const dirs = [
            path.join(process.cwd(), "uploads"),
            HLS_OUTPUT_ROOT,
        ];
        try {
            for (const dir of dirs) {
                fs.mkdirSync(dir, { recursive: true });
                const file = path.join(dir, `.health-write-${process.pid}`);
                fs.writeFileSync(file, String(Date.now()));
                fs.unlinkSync(file);
            }
            return { status: "ok", detail: dirs.join(", ") };
        } catch (err: any) {
            return { status: "error", detail: err?.message || "not writable" };
        }
    }

    private checkDisk(): HealthCheck {
        const threshold = this.diskThresholdBytes();
        const targets = [path.join(process.cwd(), "uploads"), HLS_OUTPUT_ROOT, process.cwd()];
        let minFree = Number.POSITIVE_INFINITY;
        let usedPath = targets[0];
        try {
            for (const dir of targets) {
                fs.mkdirSync(dir, { recursive: true });
                const free = this.freeBytes(dir);
                if (free < minFree) {
                    minFree = free;
                    usedPath = dir;
                }
            }
            if (!Number.isFinite(minFree)) {
                return { status: "error", detail: "statfs unavailable", thresholdBytes: threshold };
            }
            const ok = minFree >= threshold;
            return {
                status: ok ? "ok" : "error",
                freeBytes: minFree,
                thresholdBytes: threshold,
                detail: `${usedPath}: ${Math.round(minFree / 1024 / 1024)} MB free (min ${Math.round(threshold / 1024 / 1024)} MB)`,
            };
        } catch (err: any) {
            return { status: "error", detail: err?.message || "disk", thresholdBytes: threshold };
        }
    }

    private freeBytes(dir: string) {
        const fn = (fs as any).statfsSync as undefined | ((p: string) => { bavail: number | bigint; bsize: number | bigint });
        if (typeof fn !== "function") return Number.POSITIVE_INFINITY;
        const stat = fn(dir);
        return Number(stat.bavail) * Number(stat.bsize);
    }

    private checkSmtp(): HealthCheck {
        const host = process.env.SMTP_HOST?.trim();
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS?.trim();
        if (host && user && pass) {
            return { status: "ok", detail: `${host}:${process.env.SMTP_PORT || 587}` };
        }
        if (this.requireSmtp()) {
            return { status: "error", detail: "SMTP_HOST / SMTP_USER / SMTP_PASS hiányzik" };
        }
        return { status: "skip", detail: "SMTP nincs beállítva (outbox)" };
    }

    private async ensureSchema() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "OpsEvent" (
                "id" TEXT NOT NULL PRIMARY KEY,
                kind TEXT NOT NULL,
                service TEXT NOT NULL,
                message TEXT NOT NULL,
                "showId" TEXT,
                "streamId" TEXT,
                detail TEXT,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "OpsEvent_kind_createdAt_idx" ON "OpsEvent" (kind, "createdAt")`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Stream" ADD COLUMN IF NOT EXISTS "liveStartedAt" TIMESTAMPTZ`,
        ).catch(() => undefined);
    }
}

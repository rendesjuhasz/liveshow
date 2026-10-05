import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LiveViewTracker } from "./live-view-tracker";
import { assertSafeIds } from "../security/sql-ids";
import { MailService } from "../mail/mail.service";

export type ArchiveSort = "popular" | "views" | "newest" | "oldest";

@Injectable()
export class ViewLogService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ViewLogService.name);
    private ready = false;
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly live: LiveViewTracker,
        private readonly mail: MailService,
    ) {}

    async onModuleInit() {
        await this.ensureTable();
        this.timer = setInterval(() => {
            this.sampleLive().catch((err) =>
                this.logger.warn(`Nézőszám minta hiba: ${err?.message || err}`),
            );
        }, 60_000);
        this.sampleLive().catch(() => undefined);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    heartbeatLive(input: { showId?: string | null; streamId?: string | null; userId?: string | null }) {
        const flushed = this.live.heartbeat(input);
        void this.persistWatchChunks(flushed);
    }

    releaseLive(streamId: string, showId?: string | null) {
        const flushed = this.live.clearStream(streamId, showId);
        void this.persistWatchChunks(flushed);
    }

    liveNow() {
        return this.live.total();
    }

    liveByShow() {
        return this.live.byShow();
    }

    liveCountFor(showId: string) {
        return this.live.byShow().get(showId) || 0;
    }

    async qualifyArchiveView(input: {
        showId: string;
        userId: string;
        seconds?: number;
        duration?: number;
    }) {
        const showId = input.showId.trim();
        const userId = input.userId.trim();
        if (!showId || !userId) return { counted: false, viewCount: 0 };
        const seconds = Number(input.seconds || 0);
        const duration = Number(input.duration || 0);
        const enoughTime = seconds >= 10;
        const enoughShare = duration >= 8 && seconds / duration >= 0.2;
        if (!enoughTime && !enoughShare) {
            return { counted: false, viewCount: await this.viewCount(showId) };
        }
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "ArchiveView"
            WHERE "showId" = ${showId} AND "userId" = ${userId}
            LIMIT 1
        `.catch(() => []);
        if (!existing[0]) {
            await this.prisma.$executeRaw`
                INSERT INTO "ArchiveView" (id, "showId", "userId", seconds, percent, "createdAt")
                VALUES (
                    ${randomUUID()},
                    ${showId},
                    ${userId},
                    ${seconds},
                    ${duration > 0 ? seconds / duration : 0},
                    NOW()
                )
            `.catch(() => undefined);
        }
        return { counted: !existing[0], viewCount: await this.viewCount(showId) };
    }

    async viewCount(showId: string) {
        const map = await this.countsByShowIds([showId]);
        return map.get(showId) || 0;
    }

    async countsByShowIds(ids: string[]) {
        const map = new Map<string, number>();
        if (!ids.length) return map;
        assertSafeIds(ids);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT "showId", COUNT(*)::int AS views
             FROM "ArchiveView"
             WHERE "showId" IN (${placeholders})
             GROUP BY "showId"`,
            ...ids,
        ).catch(() => []);
        for (const row of rows) {
            if (row.showId) map.set(row.showId, Number(row.views || 0));
        }
        return map;
    }

    async popularCounts(ids: string[], days = 14) {
        const map = new Map<string, number>();
        if (!ids.length) return map;
        assertSafeIds(ids);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT "showId", COUNT(*)::int AS views
             FROM "ArchiveView"
             WHERE "createdAt" >= $1 AND "showId" IN (${placeholders})
             GROUP BY "showId"`,
            since,
            ...ids,
        ).catch(() => []);
        for (const row of rows) {
            if (row.showId) map.set(row.showId, Number(row.views || 0));
        }
        return map;
    }

    sortIds(ids: string[], sort: ArchiveSort, allTime: Map<string, number>, recent: Map<string, number>) {
        const copy = [...ids];
        if (sort === "views") {
            copy.sort((a, b) => (allTime.get(b) || 0) - (allTime.get(a) || 0));
        } else if (sort === "popular") {
            copy.sort((a, b) => {
                const d = (recent.get(b) || 0) - (recent.get(a) || 0);
                if (d !== 0) return d;
                return (allTime.get(b) || 0) - (allTime.get(a) || 0);
            });
        }
        return copy;
    }

    async streamerStats(streamerId: string, shows: { id: string; title: string }[]) {
        const ids = shows.map((s) => s.id);
        const counts = await this.countsByShowIds(ids);
        const peaks = await this.peaksByShowIds(ids);
        const avgs = await this.averageWatchByShowIds(ids);
        const perVideo = shows
            .map((s) => ({
                showId: s.id,
                title: s.title,
                views: counts.get(s.id) || 0,
                peakViewers: peaks.get(s.id) || 0,
                avgWatchSeconds: avgs.get(s.id) || 0,
            }))
            .sort((a, b) => b.views - a.views);
        const totalViews = perVideo.reduce((sum, row) => sum + row.views, 0);
        const top = perVideo[0] && perVideo[0].views > 0 ? perVideo[0] : null;
        const avgLive = await this.averageLiveViewers(ids);
        const peakLiveViewers = await this.peakLiveViewers(ids);
        const averageWatchSeconds = await this.averageWatchSeconds(ids);
        const streamErrors = await this.listStreamErrorsForShows(ids, 20);
        return {
            totalViews,
            averageLiveViewers: avgLive,
            peakLiveViewers,
            averageWatchSeconds,
            topVideo: top,
            videos: perVideo,
            streamErrors,
        };
    }

    async archiveViewsByShow() {
        try {
            return await this.prisma.$queryRaw<any[]>`
                SELECT "showId", COUNT(*)::int AS views
                FROM "ArchiveView"
                WHERE "showId" IS NOT NULL
                GROUP BY "showId"
            `;
        } catch {
            return [];
        }
    }

    async archiveViewTotal() {
        try {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS count FROM "ArchiveView"
            `;
            return rows[0]?.count || 0;
        } catch {
            return 0;
        }
    }

    async peakLiveViewers(showIds: string[]) {
        const map = await this.peaksByShowIds(showIds);
        let peak = 0;
        for (const value of map.values()) peak = Math.max(peak, value);
        const live = this.live.byShow();
        for (const id of showIds) peak = Math.max(peak, live.get(id) || 0);
        return peak;
    }

    async peaksByShowIds(ids: string[]) {
        const map = new Map<string, number>();
        if (!ids.length) return map;
        assertSafeIds(ids);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT "showId", MAX(viewers)::int AS peak
             FROM "LiveViewSample"
             WHERE "showId" IN (${placeholders})
             GROUP BY "showId"`,
            ...ids,
        ).catch(() => []);
        for (const row of rows) {
            if (row.showId) map.set(row.showId, Number(row.peak || 0));
        }
        const live = this.live.byShow();
        for (const id of ids) {
            map.set(id, Math.max(map.get(id) || 0, live.get(id) || 0));
        }
        return map;
    }

    async averageWatchSeconds(showIds: string[]) {
        const map = await this.averageWatchByShowIds(showIds);
        const values = [...map.values()].filter((n) => n > 0);
        if (!values.length) return 0;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }

    async averageWatchByShowIds(ids: string[]) {
        const map = new Map<string, number>();
        if (!ids.length) return map;
        assertSafeIds(ids);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT "showId", AVG(seconds)::float AS avg
             FROM (
                SELECT "showId", seconds FROM "ArchiveView"
                WHERE "showId" IN (${placeholders}) AND seconds > 0
                UNION ALL
                SELECT "showId", seconds FROM "WatchSession"
                WHERE "showId" IN (${placeholders}) AND seconds > 0
             ) t
             GROUP BY "showId"`,
            ...ids,
        ).catch(() => []);
        for (const row of rows) {
            if (row.showId) map.set(row.showId, Math.round(Number(row.avg || 0)));
        }
        return map;
    }

    async platformWatchAverage() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT AVG(seconds)::float AS avg FROM (
                SELECT seconds FROM "ArchiveView" WHERE seconds > 0
                UNION ALL
                SELECT seconds FROM "WatchSession" WHERE seconds > 0
            ) t
        `.catch(() => [{ avg: 0 }]);
        return Math.round(Number(rows[0]?.avg || 0));
    }

    async platformPeakViewers() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT COALESCE(MAX(viewers), 0)::int AS peak FROM "LiveViewSample"
        `.catch(() => [{ peak: 0 }]);
        return Math.max(Number(rows[0]?.peak || 0), this.live.total());
    }

    async logStreamError(input: {
        showId?: string | null;
        streamId?: string | null;
        message?: string | null;
        source?: string | null;
    }) {
        const message = String(input.message || "").trim();
        if (!message) return;
        if (/már fut az ingest/i.test(message)) return;
        await this.prisma.$executeRaw`
            INSERT INTO "StreamStartError" (id, "showId", "streamId", message, source, "createdAt")
            VALUES (
                ${randomUUID()},
                ${input.showId || null},
                ${input.streamId || null},
                ${message.slice(0, 500)},
                ${String(input.source || "ingest").slice(0, 40)},
                NOW()
            )
        `.catch(() => undefined);
        const source = String(input.source || "ingest").slice(0, 40);
        const kind =
            source === "archive"
                ? "archive_fail"
                : source === "dashboard"
                  ? "stream_start"
                  : "ingest_fail";
        void this.mail.opsAlert({
            kind,
            service: source === "archive" ? "archive" : "ingest",
            message,
            showId: input.showId,
            streamId: input.streamId,
            detail: source,
        });
    }

    async listStreamErrors(limit = 40) {
        const take = Math.min(100, Math.max(1, Number(limit) || 40));
        return this.prisma.$queryRaw<any[]>`
            SELECT e.id, e."showId", e."streamId", e.message, e.source, e."createdAt", s.title AS "showTitle"
            FROM "StreamStartError" e
            LEFT JOIN "Show" s ON s.id = e."showId"
            ORDER BY e."createdAt" DESC
            LIMIT ${take}
        `.catch(() => []);
    }

    async listStreamErrorsForShows(showIds: string[], limit = 20) {
        if (!showIds.length) return [];
        assertSafeIds(showIds);
        const take = Math.min(50, Math.max(1, Number(limit) || 20));
        const placeholders = showIds.map((_, i) => `$${i + 1}`).join(", ");
        return this.prisma.$queryRawUnsafe<any[]>(
            `SELECT e.id, e."showId", e."streamId", e.message, e.source, e."createdAt", s.title AS "showTitle"
             FROM "StreamStartError" e
             LEFT JOIN "Show" s ON s.id = e."showId"
             WHERE e."showId" IN (${placeholders})
             ORDER BY e."createdAt" DESC
             LIMIT ${take}`,
            ...showIds,
        ).catch(() => []);
    }

    private async persistWatchChunks(
        sessions: { showId?: string | null; userId?: string | null; seconds: number }[],
    ) {
        for (const session of sessions) {
            if (!session.showId || session.seconds < 2) continue;
            await this.prisma.$executeRaw`
                INSERT INTO "WatchSession" (id, "showId", "userId", seconds, "createdAt")
                VALUES (
                    ${randomUUID()},
                    ${session.showId},
                    ${session.userId || null},
                    ${Math.round(session.seconds)},
                    NOW()
                )
            `.catch(() => undefined);
        }
    }

    private async averageLiveViewers(showIds: string[]) {
        if (!showIds.length) return 0;
        const placeholders = showIds.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT AVG(viewers)::float AS avg FROM "LiveViewSample" WHERE "showId" IN (${placeholders})`,
            ...showIds,
        ).catch(() => [{ avg: 0 }]);
        return Math.round(Number(rows[0]?.avg || 0) * 10) / 10;
    }

    private async sampleLive() {
        void this.persistWatchChunks(this.live.takeExpired());
        const liveShows = await this.prisma.show.findMany({
            where: { live: true },
            select: { id: true },
        }).catch(() => []);
        const counts = this.live.byShow();
        for (const show of liveShows) {
            const viewers = counts.get(show.id) || 0;
            await this.prisma.$executeRaw`
                INSERT INTO "LiveViewSample" (id, "showId", viewers, "createdAt")
                VALUES (${randomUUID()}, ${show.id}, ${viewers}, NOW())
            `.catch(() => undefined);
        }
    }

    private async ensureTable() {
        if (this.ready) return;
        const stmts = [
            `CREATE TABLE IF NOT EXISTS "ViewEvent" (
                "id" TEXT NOT NULL,
                "showId" TEXT,
                "streamId" TEXT,
                "userId" TEXT,
                "kind" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "ViewEvent_pkey" PRIMARY KEY ("id")
            )`,
            `CREATE TABLE IF NOT EXISTS "ArchiveView" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "showId" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
                percent DOUBLE PRECISION NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE("showId", "userId")
            )`,
            `CREATE TABLE IF NOT EXISTS "LiveViewSample" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "showId" TEXT NOT NULL,
                viewers INT NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS "LiveViewSample_showId_idx" ON "LiveViewSample" ("showId", "createdAt")`,
            `CREATE INDEX IF NOT EXISTS "ArchiveView_showId_idx" ON "ArchiveView" ("showId")`,
            `CREATE TABLE IF NOT EXISTS "WatchSession" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "showId" TEXT NOT NULL,
                "userId" TEXT,
                seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS "WatchSession_showId_idx" ON "WatchSession" ("showId")`,
            `CREATE TABLE IF NOT EXISTS "StreamStartError" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "showId" TEXT,
                "streamId" TEXT,
                message TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'ingest',
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS "StreamStartError_createdAt_idx" ON "StreamStartError" ("createdAt")`,
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
        this.ready = true;
    }
}

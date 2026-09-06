import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LiveViewTracker } from "./live-view-tracker";

export type ArchiveSort = "popular" | "views" | "newest" | "oldest";

@Injectable()
export class ViewLogService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ViewLogService.name);
    private ready = false;
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly live: LiveViewTracker,
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
        this.live.heartbeat(input);
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
        await this.ensureTable();
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
        await this.ensureTable();
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
        await this.ensureTable();
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
        const perVideo = shows
            .map((s) => ({ showId: s.id, title: s.title, views: counts.get(s.id) || 0 }))
            .sort((a, b) => b.views - a.views);
        const totalViews = perVideo.reduce((sum, row) => sum + row.views, 0);
        const top = perVideo[0] && perVideo[0].views > 0 ? perVideo[0] : null;
        const avgLive = await this.averageLiveViewers(ids);
        return {
            totalViews,
            averageLiveViewers: avgLive,
            topVideo: top,
            videos: perVideo,
        };
    }

    async archiveViewsByShow() {
        await this.ensureTable();
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
        await this.ensureTable();
        try {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS count FROM "ArchiveView"
            `;
            return rows[0]?.count || 0;
        } catch {
            return 0;
        }
    }

    private async averageLiveViewers(showIds: string[]) {
        if (!showIds.length) return 0;
        await this.ensureTable();
        const placeholders = showIds.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT AVG(viewers)::float AS avg FROM "LiveViewSample" WHERE "showId" IN (${placeholders})`,
            ...showIds,
        ).catch(() => [{ avg: 0 }]);
        return Math.round(Number(rows[0]?.avg || 0) * 10) / 10;
    }

    private async sampleLive() {
        await this.ensureTable();
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
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
        this.ready = true;
    }
}

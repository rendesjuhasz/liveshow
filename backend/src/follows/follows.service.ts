import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ensureFollowSchema, FOLLOW_NOTIFY, type FollowNotifyKind } from "./follow-schema";
import { isApprovedStreamer } from "../streamers/status";

export type NotifyPrefs = {
    notifyNewShow: boolean;
    notify24h: boolean;
    notify1h: boolean;
    notifyLive: boolean;
    emailEnabled: boolean;
};

const DEFAULT_PREFS: NotifyPrefs = {
    notifyNewShow: true,
    notify24h: true,
    notify1h: true,
    notifyLive: true,
    emailEnabled: true,
};

@Injectable()
export class FollowsService implements OnModuleInit {
    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await ensureFollowSchema(this.prisma);
    }

    async follow(userId: string, streamerId: string) {
        const streamer = await this.prisma.streamer.findUnique({ where: { id: streamerId } });
        if (!streamer || !isApprovedStreamer(streamer.status)) {
            throw new NotFoundException("A tartalomkészítő nem található.");
        }
        if (streamer.userId && streamer.userId === userId) {
            throw new BadRequestException("Saját magadat nem követheted.");
        }
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "StreamerFollow" WHERE "userId" = ${userId} AND "streamerId" = ${streamerId} LIMIT 1
        `;
        if (existing[0]) {
            return { following: true, followerCount: await this.followerCount(streamerId) };
        }
        await this.prisma.$executeRaw`
            INSERT INTO "StreamerFollow" (id, "userId", "streamerId", "createdAt")
            VALUES (${randomUUID()}, ${userId}, ${streamerId}, NOW())
        `;
        return { following: true, followerCount: await this.followerCount(streamerId) };
    }

    async unfollow(userId: string, streamerId: string) {
        await this.prisma.$executeRaw`
            DELETE FROM "StreamerFollow" WHERE "userId" = ${userId} AND "streamerId" = ${streamerId}
        `;
        return { following: false, followerCount: await this.followerCount(streamerId) };
    }

    async isFollowing(userId: string | undefined, streamerId: string) {
        if (!userId) return false;
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "StreamerFollow" WHERE "userId" = ${userId} AND "streamerId" = ${streamerId} LIMIT 1
        `;
        return Boolean(rows[0]);
    }

    async followerCount(streamerId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT COUNT(*)::int AS count FROM "StreamerFollow" WHERE "streamerId" = ${streamerId}
        `;
        return Number(rows[0]?.count || 0);
    }

    async getPrefs(userId: string): Promise<NotifyPrefs> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT "notifyNewShow", "notify24h", "notify1h", "notifyLive", "emailEnabled"
            FROM "NotificationPref" WHERE "userId" = ${userId} LIMIT 1
        `;
        const row = rows[0];
        if (!row) return { ...DEFAULT_PREFS };
        return {
            notifyNewShow: row.notifyNewShow !== false,
            notify24h: row.notify24h !== false,
            notify1h: row.notify1h !== false,
            notifyLive: row.notifyLive !== false,
            emailEnabled: row.emailEnabled !== false,
        };
    }

    async setPrefs(userId: string, patch: Partial<NotifyPrefs>) {
        const current = await this.getPrefs(userId);
        const next: NotifyPrefs = {
            notifyNewShow: patch.notifyNewShow ?? current.notifyNewShow,
            notify24h: patch.notify24h ?? current.notify24h,
            notify1h: patch.notify1h ?? current.notify1h,
            notifyLive: patch.notifyLive ?? current.notifyLive,
            emailEnabled: patch.emailEnabled ?? current.emailEnabled,
        };
        await this.prisma.$executeRaw`
            INSERT INTO "NotificationPref" ("userId", "notifyNewShow", "notify24h", "notify1h", "notifyLive", "emailEnabled")
            VALUES (${userId}, ${next.notifyNewShow}, ${next.notify24h}, ${next.notify1h}, ${next.notifyLive}, ${next.emailEnabled})
            ON CONFLICT ("userId") DO UPDATE SET
                "notifyNewShow" = ${next.notifyNewShow},
                "notify24h" = ${next.notify24h},
                "notify1h" = ${next.notify1h},
                "notifyLive" = ${next.notifyLive},
                "emailEnabled" = ${next.emailEnabled}
        `;
        return next;
    }

    prefAllows(prefs: NotifyPrefs, kind: FollowNotifyKind) {
        if (kind === FOLLOW_NOTIFY.newShow) return prefs.notifyNewShow;
        if (kind === FOLLOW_NOTIFY.reminder24h) return prefs.notify24h;
        if (kind === FOLLOW_NOTIFY.reminder1h) return prefs.notify1h;
        if (kind === FOLLOW_NOTIFY.reminder2h || kind === FOLLOW_NOTIFY.reminder30m) return prefs.notify1h;
        return prefs.notifyLive;
    }

    async dashboardStats(streamerId: string) {
        const followerCount = await this.followerCount(streamerId);
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const week = await this.prisma.$queryRaw<any[]>`
            SELECT COUNT(*)::int AS count FROM "StreamerFollow"
            WHERE "streamerId" = ${streamerId} AND "createdAt" >= ${since}
        `;
        const recent = await this.prisma.$queryRaw<any[]>`
            SELECT f.id, f."createdAt", u.username AS "userName"
            FROM "StreamerFollow" f
            JOIN "User" u ON u.id = f."userId"
            WHERE f."streamerId" = ${streamerId}
            ORDER BY f."createdAt" DESC
            LIMIT 15
        `;
        const byShow = await this.prisma.$queryRaw<any[]>`
            SELECT s.id AS "showId", s.title, s."isPrivate",
                   n.kind, n."sentCount", n."clickCount"
            FROM "Show" s
            LEFT JOIN "ShowNotifyStat" n ON n."showId" = s.id
            WHERE s."streamerId" = ${streamerId}
            ORDER BY s."startTime" DESC NULLS LAST
            LIMIT 80
        `.catch(() => []);
        const shows: Record<
            string,
            { showId: string; title: string; isPrivate: boolean; sent: number; clicks: number }
        > = {};
        for (const row of byShow) {
            const id = row.showId;
            if (!shows[id]) {
                shows[id] = {
                    showId: id,
                    title: row.title,
                    isPrivate: Boolean(row.isPrivate),
                    sent: 0,
                    clicks: 0,
                };
            }
            shows[id].sent += Number(row.sentCount || 0);
            shows[id].clicks += Number(row.clickCount || 0);
        }
        return {
            followerCount,
            newFollowers7d: Number(week[0]?.count || 0),
            recentFollowers: recent.map((r) => ({
                id: r.id,
                name: String(r.userName || "").trim() || "Néző",
                createdAt: r.createdAt,
            })),
            shows: Object.values(shows),
        };
    }

    async recordOpen(userId: string, notificationId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, type, "relatedId", clicked, link
            FROM "UserNotification"
            WHERE id = ${notificationId} AND "userId" = ${userId}
            LIMIT 1
        `;
        const note = rows[0];
        if (!note) throw new ForbiddenException("Az értesítés nem található.");
        await this.prisma.$executeRaw`
            UPDATE "UserNotification" SET read = true WHERE id = ${notificationId} AND "userId" = ${userId}
        `;
        if (!note.clicked && note.relatedId && String(note.type || "").startsWith("follow_")) {
            await this.prisma.$executeRaw`
                UPDATE "UserNotification" SET clicked = true WHERE id = ${notificationId}
            `;
            await this.prisma.$executeRaw`
                UPDATE "ShowNotifyStat"
                SET "clickCount" = "clickCount" + 1, "updatedAt" = NOW()
                WHERE "showId" = ${note.relatedId} AND kind = ${note.type}
            `.catch(() => undefined);
        }
        return { ok: true, link: note.link || (note.relatedId ? `/shows/${note.relatedId}` : null) };
    }

    async bumpSent(showId: string, kind: FollowNotifyKind, count: number) {
        if (count <= 0) return;
        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "ShowNotifyStat" (id, "showId", kind, "sentCount", "clickCount", "updatedAt")
            VALUES (${id}, ${showId}, ${kind}, ${count}, 0, NOW())
            ON CONFLICT ("showId", kind) DO UPDATE SET
                "sentCount" = "ShowNotifyStat"."sentCount" + ${count},
                "updatedAt" = NOW()
        `;
    }
}

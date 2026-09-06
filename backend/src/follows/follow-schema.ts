import { PrismaService } from "../prisma/prisma.service";

export const FOLLOW_NOTIFY = {
    newShow: "follow_new_show",
    reminder24h: "follow_reminder_24h",
    reminder1h: "follow_reminder_1h",
    goingLive: "follow_going_live",
} as const;

export type FollowNotifyKind = (typeof FOLLOW_NOTIFY)[keyof typeof FOLLOW_NOTIFY];

export async function ensureFollowSchema(prisma: PrismaService) {
    const stmts = [
        `CREATE TABLE IF NOT EXISTS "StreamerFollow" (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "streamerId" TEXT NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("userId", "streamerId")
        )`,
        `CREATE INDEX IF NOT EXISTS "StreamerFollow_streamerId_idx" ON "StreamerFollow" ("streamerId", "createdAt")`,
        `CREATE TABLE IF NOT EXISTS "CategoryFollow" (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "categoryKey" TEXT NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("userId", "categoryKey")
        )`,
        `CREATE TABLE IF NOT EXISTS "NotificationPref" (
            "userId" TEXT PRIMARY KEY,
            "notifyNewShow" BOOLEAN NOT NULL DEFAULT true,
            "notify24h" BOOLEAN NOT NULL DEFAULT true,
            "notify1h" BOOLEAN NOT NULL DEFAULT true,
            "notifyLive" BOOLEAN NOT NULL DEFAULT true,
            "emailEnabled" BOOLEAN NOT NULL DEFAULT true
        )`,
        `CREATE TABLE IF NOT EXISTS "ShowNotifyStat" (
            id TEXT PRIMARY KEY,
            "showId" TEXT NOT NULL,
            kind TEXT NOT NULL,
            "sentCount" INT NOT NULL DEFAULT 0,
            "clickCount" INT NOT NULL DEFAULT 0,
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("showId", kind)
        )`,
        `ALTER TABLE "UserNotification" ADD COLUMN IF NOT EXISTS link TEXT`,
        `ALTER TABLE "UserNotification" ADD COLUMN IF NOT EXISTS clicked BOOLEAN NOT NULL DEFAULT false`,
    ];
    for (const sql of stmts) {
        await prisma.$executeRawUnsafe(sql).catch(() => undefined);
    }
}

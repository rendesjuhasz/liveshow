import type { PrismaService } from "../prisma/prisma.service";
import { CLIP_LENGTHS, normalizeClipLength } from "./clip-score";

export type MarketingSettingsRow = {
    id: string;
    clipEnabled: boolean;
    clipLengthSec: number;
    tiktokEnabled: boolean;
    tiktokMaxPerDay: number;
    tiktokCaptions: boolean;
    tiktokHashtags: boolean;
    facebookReelsEnabled: boolean;
    facebookMaxPerDay: number;
    facebookAutoPublish: boolean;
    facebookManualApproval: boolean;
    instagramEnabled: boolean;
    youtubeShortsEnabled: boolean;
    imageGenEnabled: boolean;
    autoKitEnabled: boolean;
    nextShowPromoEnabled: boolean;
    ticketPromoEnabled: boolean;
    notifyEmail: boolean;
    notifyPush: boolean;
    notifyDiscord: boolean;
    notifyTelegram: boolean;
    discordWebhook: string;
    telegramChatId: string;
};

export const DEFAULT_MARKETING_SETTINGS: MarketingSettingsRow = {
    id: "platform",
    clipEnabled: true,
    clipLengthSec: 30,
    tiktokEnabled: false,
    tiktokMaxPerDay: 3,
    tiktokCaptions: true,
    tiktokHashtags: true,
    facebookReelsEnabled: false,
    facebookMaxPerDay: 3,
    facebookAutoPublish: false,
    facebookManualApproval: true,
    instagramEnabled: false,
    youtubeShortsEnabled: false,
    imageGenEnabled: false,
    autoKitEnabled: true,
    nextShowPromoEnabled: true,
    ticketPromoEnabled: true,
    notifyEmail: true,
    notifyPush: true,
    notifyDiscord: false,
    notifyTelegram: false,
    discordWebhook: "",
    telegramChatId: "",
};

export async function ensureMarketingAutoSchema(prisma: PrismaService) {
    const stmts = [
        `CREATE TABLE IF NOT EXISTS "MarketingSettings" (
            "id" TEXT PRIMARY KEY DEFAULT 'platform',
            "clipEnabled" BOOLEAN NOT NULL DEFAULT true,
            "clipLengthSec" INTEGER NOT NULL DEFAULT 30,
            "tiktokEnabled" BOOLEAN NOT NULL DEFAULT false,
            "tiktokMaxPerDay" INTEGER NOT NULL DEFAULT 3,
            "tiktokCaptions" BOOLEAN NOT NULL DEFAULT true,
            "tiktokHashtags" BOOLEAN NOT NULL DEFAULT true,
            "facebookReelsEnabled" BOOLEAN NOT NULL DEFAULT false,
            "facebookMaxPerDay" INTEGER NOT NULL DEFAULT 3,
            "facebookAutoPublish" BOOLEAN NOT NULL DEFAULT false,
            "facebookManualApproval" BOOLEAN NOT NULL DEFAULT true,
            "instagramEnabled" BOOLEAN NOT NULL DEFAULT false,
            "youtubeShortsEnabled" BOOLEAN NOT NULL DEFAULT false,
            "imageGenEnabled" BOOLEAN NOT NULL DEFAULT false,
            "autoKitEnabled" BOOLEAN NOT NULL DEFAULT true,
            "nextShowPromoEnabled" BOOLEAN NOT NULL DEFAULT true,
            "ticketPromoEnabled" BOOLEAN NOT NULL DEFAULT true,
            "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
            "notifyPush" BOOLEAN NOT NULL DEFAULT true,
            "notifyDiscord" BOOLEAN NOT NULL DEFAULT false,
            "notifyTelegram" BOOLEAN NOT NULL DEFAULT false,
            "discordWebhook" TEXT,
            "telegramChatId" TEXT,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `INSERT INTO "MarketingSettings" ("id") VALUES ('platform') ON CONFLICT ("id") DO NOTHING`,
        `CREATE TABLE IF NOT EXISTS "StreamClip" (
            "id" TEXT PRIMARY KEY,
            "showId" TEXT NOT NULL,
            "streamId" TEXT NOT NULL,
            "offsetSec" INTEGER NOT NULL,
            "durationSec" INTEGER NOT NULL,
            "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "reason" TEXT NOT NULL,
            "viewers" INTEGER NOT NULL DEFAULT 0,
            "chatCount" INTEGER NOT NULL DEFAULT 0,
            "questionCount" INTEGER NOT NULL DEFAULT 0,
            "supportCount" INTEGER NOT NULL DEFAULT 0,
            "rank" INTEGER,
            "filePath" TEXT,
            "verticalPath" TEXT,
            "publicPath" TEXT,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "lastError" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS "StreamClip_showId_createdAt_idx" ON "StreamClip"("showId", "createdAt")`,
        `CREATE TABLE IF NOT EXISTS "MarketingJob" (
            "id" TEXT PRIMARY KEY,
            "showId" TEXT,
            "clipId" TEXT,
            "type" TEXT NOT NULL,
            "channel" TEXT NOT NULL DEFAULT '',
            "status" TEXT NOT NULL DEFAULT 'pending',
            "dedupeKey" TEXT NOT NULL UNIQUE,
            "payload" JSONB,
            "lastError" TEXT,
            "scheduledAt" TIMESTAMP(3),
            "ranAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS "MarketingJob_status_scheduledAt_idx" ON "MarketingJob"("status", "scheduledAt")`,
    ];
    for (const sql of stmts) {
        await prisma.$executeRawUnsafe(sql).catch(() => undefined);
    }
}

export function serializeSettings(row: Partial<MarketingSettingsRow> | null): MarketingSettingsRow {
    return {
        ...DEFAULT_MARKETING_SETTINGS,
        ...row,
        clipLengthSec: normalizeClipLength(row?.clipLengthSec ?? DEFAULT_MARKETING_SETTINGS.clipLengthSec),
        discordWebhook: String(row?.discordWebhook || ""),
        telegramChatId: String(row?.telegramChatId || ""),
    };
}

export function parseSettingsPatch(body: Record<string, unknown>): Partial<MarketingSettingsRow> {
    const bool = (k: string) => (body[k] === undefined ? undefined : Boolean(body[k]));
    const num = (k: string) => (body[k] === undefined ? undefined : Number(body[k]));
    const patch: Partial<MarketingSettingsRow> = {
        clipEnabled: bool("clipEnabled"),
        clipLengthSec: body.clipLengthSec !== undefined ? normalizeClipLength(body.clipLengthSec) : undefined,
        tiktokEnabled: bool("tiktokEnabled"),
        tiktokMaxPerDay: num("tiktokMaxPerDay"),
        tiktokCaptions: bool("tiktokCaptions"),
        tiktokHashtags: bool("tiktokHashtags"),
        facebookReelsEnabled: bool("facebookReelsEnabled"),
        facebookMaxPerDay: num("facebookMaxPerDay"),
        facebookAutoPublish: bool("facebookAutoPublish"),
        facebookManualApproval: bool("facebookManualApproval"),
        instagramEnabled: bool("instagramEnabled"),
        youtubeShortsEnabled: bool("youtubeShortsEnabled"),
        imageGenEnabled: bool("imageGenEnabled"),
        autoKitEnabled: bool("autoKitEnabled"),
        nextShowPromoEnabled: bool("nextShowPromoEnabled"),
        ticketPromoEnabled: bool("ticketPromoEnabled"),
        notifyEmail: bool("notifyEmail"),
        notifyPush: bool("notifyPush"),
        notifyDiscord: bool("notifyDiscord"),
        notifyTelegram: bool("notifyTelegram"),
        discordWebhook: body.discordWebhook !== undefined ? String(body.discordWebhook || "").trim() : undefined,
        telegramChatId: body.telegramChatId !== undefined ? String(body.telegramChatId || "").trim() : undefined,
    };
    for (const key of Object.keys(patch) as (keyof MarketingSettingsRow)[]) {
        if (patch[key] === undefined) delete patch[key];
    }
    if (patch.tiktokMaxPerDay != null) patch.tiktokMaxPerDay = Math.min(20, Math.max(1, patch.tiktokMaxPerDay));
    if (patch.facebookMaxPerDay != null) {
        patch.facebookMaxPerDay = Math.min(20, Math.max(1, patch.facebookMaxPerDay));
    }
    return patch;
}

export async function loadSettingsRow(prisma: PrismaService) {
    const rows = await prisma.$queryRaw<Partial<MarketingSettingsRow>[]>`
        SELECT * FROM "MarketingSettings" WHERE id = 'platform' LIMIT 1
    `.catch(() => []);
    return serializeSettings(rows[0] || null);
}

export async function saveSettingsRow(prisma: PrismaService, patch: Partial<MarketingSettingsRow>) {
    await prisma.$executeRaw`
        INSERT INTO "MarketingSettings" ("id") VALUES ('platform')
        ON CONFLICT ("id") DO NOTHING
    `.catch(() => undefined);
    const current = await loadSettingsRow(prisma);
    const next = serializeSettings({ ...current, ...patch });
    await prisma.$executeRaw`
        UPDATE "MarketingSettings"
        SET
            "clipEnabled" = ${next.clipEnabled},
            "clipLengthSec" = ${next.clipLengthSec},
            "tiktokEnabled" = ${next.tiktokEnabled},
            "tiktokMaxPerDay" = ${next.tiktokMaxPerDay},
            "tiktokCaptions" = ${next.tiktokCaptions},
            "tiktokHashtags" = ${next.tiktokHashtags},
            "facebookReelsEnabled" = ${next.facebookReelsEnabled},
            "facebookMaxPerDay" = ${next.facebookMaxPerDay},
            "facebookAutoPublish" = ${next.facebookAutoPublish},
            "facebookManualApproval" = ${next.facebookManualApproval},
            "instagramEnabled" = ${next.instagramEnabled},
            "youtubeShortsEnabled" = ${next.youtubeShortsEnabled},
            "imageGenEnabled" = ${next.imageGenEnabled},
            "autoKitEnabled" = ${next.autoKitEnabled},
            "nextShowPromoEnabled" = ${next.nextShowPromoEnabled},
            "ticketPromoEnabled" = ${next.ticketPromoEnabled},
            "notifyEmail" = ${next.notifyEmail},
            "notifyPush" = ${next.notifyPush},
            "notifyDiscord" = ${next.notifyDiscord},
            "notifyTelegram" = ${next.notifyTelegram},
            "discordWebhook" = ${next.discordWebhook || null},
            "telegramChatId" = ${next.telegramChatId || null},
            "updatedAt" = NOW()
        WHERE id = 'platform'
    `;
    return next;
}

export { CLIP_LENGTHS };

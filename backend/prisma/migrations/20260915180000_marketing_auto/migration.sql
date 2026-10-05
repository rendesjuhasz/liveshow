CREATE TABLE IF NOT EXISTS "MarketingSettings" (
  "id" TEXT NOT NULL DEFAULT 'platform',
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "MarketingSettings" ("id") VALUES ('platform') ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "StreamClip" (
  "id" TEXT NOT NULL,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreamClip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StreamClip_showId_createdAt_idx" ON "StreamClip"("showId", "createdAt");
CREATE INDEX IF NOT EXISTS "StreamClip_showId_rank_idx" ON "StreamClip"("showId", "rank");

DO $$ BEGIN
  ALTER TABLE "StreamClip" ADD CONSTRAINT "StreamClip_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MarketingJob" (
  "id" TEXT NOT NULL,
  "showId" TEXT,
  "clipId" TEXT,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dedupeKey" TEXT NOT NULL,
  "payload" JSONB,
  "lastError" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "ranAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingJob_dedupeKey_key" ON "MarketingJob"("dedupeKey");
CREATE INDEX IF NOT EXISTS "MarketingJob_status_scheduledAt_idx" ON "MarketingJob"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "MarketingJob_type_createdAt_idx" ON "MarketingJob"("type", "createdAt");

DO $$ BEGIN
  ALTER TABLE "MarketingJob" ADD CONSTRAINT "MarketingJob_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

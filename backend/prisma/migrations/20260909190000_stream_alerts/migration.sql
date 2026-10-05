CREATE TABLE IF NOT EXISTS "StreamAlert" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "showId" TEXT,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    CONSTRAINT "StreamAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StreamAlert_showId_createdAt_idx" ON "StreamAlert"("showId", "createdAt");
CREATE INDEX IF NOT EXISTS "StreamAlert_streamId_createdAt_idx" ON "StreamAlert"("streamId", "createdAt");
CREATE INDEX IF NOT EXISTS "StreamAlert_resolvedAt_severity_idx" ON "StreamAlert"("resolvedAt", "severity");

CREATE TABLE IF NOT EXISTS "StreamAlertPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "discordWebhook" TEXT,
    "telegramChatId" TEXT,
    CONSTRAINT "StreamAlertPref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StreamAlertPref_userId_key" ON "StreamAlertPref"("userId");

DO $$ BEGIN
    ALTER TABLE "StreamAlert" ADD CONSTRAINT "StreamAlert_showId_fkey"
        FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StreamAlertPref" ADD CONSTRAINT "StreamAlertPref_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

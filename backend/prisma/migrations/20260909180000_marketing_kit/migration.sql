-- Marketing kit generator + social publish
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "transcript" TEXT;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "tags" TEXT;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "chapters" JSONB;

CREATE TABLE IF NOT EXISTS "MarketingKit" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "streamId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'hu',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "facebookPost" TEXT NOT NULL,
    "linkedinPost" TEXT NOT NULL,
    "xPost" TEXT NOT NULL,
    "newsletterContent" TEXT NOT NULL,
    "emailSubject1" TEXT NOT NULL,
    "emailSubject2" TEXT NOT NULL,
    "emailSubject3" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,
    "youtubeDescription" TEXT NOT NULL,
    "blogOutline" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL,
    "ctaVariants" TEXT NOT NULL,
    "promoPhrases" TEXT NOT NULL,
    "webinarVersion" TEXT,
    "businessVersion" TEXT,
    "model" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "MarketingKit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingKit_showId_generatedAt_idx" ON "MarketingKit"("showId", "generatedAt");
CREATE INDEX IF NOT EXISTS "MarketingKit_createdBy_idx" ON "MarketingKit"("createdBy");

CREATE TABLE IF NOT EXISTS "MarketingKitRun" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "kitId" TEXT,
    "createdBy" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingKitRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingKitRun_showId_createdAt_idx" ON "MarketingKitRun"("showId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingKitRun_createdBy_idx" ON "MarketingKitRun"("createdBy");

CREATE TABLE IF NOT EXISTS "SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "refreshEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialAccount_userId_provider_accountId_key" ON "SocialAccount"("userId", "provider", "accountId");
CREATE INDEX IF NOT EXISTS "SocialAccount_userId_provider_idx" ON "SocialAccount"("userId", "provider");

CREATE TABLE IF NOT EXISTS "MarketingPublish" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingPublish_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingPublish_status_nextAttemptAt_idx" ON "MarketingPublish"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "MarketingPublish_showId_createdAt_idx" ON "MarketingPublish"("showId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "MarketingKit" ADD CONSTRAINT "MarketingKit_showId_fkey"
        FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MarketingKit" ADD CONSTRAINT "MarketingKit_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MarketingPublish" ADD CONSTRAINT "MarketingPublish_kitId_fkey"
        FOREIGN KEY ("kitId") REFERENCES "MarketingKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MarketingPublish" ADD CONSTRAINT "MarketingPublish_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

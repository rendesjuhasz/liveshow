ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "filterReason" TEXT;

CREATE INDEX IF NOT EXISTS "ChatMessage_showId_createdAt_idx" ON "ChatMessage"("showId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_showId_status_idx" ON "ChatMessage"("showId", "status");

CREATE TABLE IF NOT EXISTS "ContentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "note" TEXT,
    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentReport_reporterId_targetType_targetId_key"
    ON "ContentReport"("reporterId", "targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentReport_targetType_targetId_idx" ON "ContentReport"("targetType", "targetId");

DO $$ BEGIN
    ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey"
        FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reviewedById_fkey"
        FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

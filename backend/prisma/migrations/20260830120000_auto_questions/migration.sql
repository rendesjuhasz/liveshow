-- Auto question ranking + viewer notifications + live support channel

ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "topicKey" TEXT;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "liveQuestionTopicKey" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "questionRedeemedAt" TIMESTAMP(3);

UPDATE "Question" SET status = 'pending' WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserNotification_userId_idx" ON "UserNotification"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "ShowSupport" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowSupport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShowSupport_showId_idx" ON "ShowSupport"("showId", "createdAt");

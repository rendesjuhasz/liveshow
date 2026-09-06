-- AlterTable
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "filterReason" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

UPDATE "Question" SET "status" = 'approved' WHERE "status" IS NULL OR "status" = 'pending';

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuestionAudit" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BannedWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedWord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BannedWord_word_key" ON "BannedWord"("word");

ALTER TABLE "QuestionAudit" DROP CONSTRAINT IF EXISTS "QuestionAudit_questionId_fkey";
ALTER TABLE "QuestionAudit" ADD CONSTRAINT "QuestionAudit_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionAudit" DROP CONSTRAINT IF EXISTS "QuestionAudit_showId_fkey";
ALTER TABLE "QuestionAudit" ADD CONSTRAINT "QuestionAudit_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionAudit" DROP CONSTRAINT IF EXISTS "QuestionAudit_actorUserId_fkey";
ALTER TABLE "QuestionAudit" ADD CONSTRAINT "QuestionAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "BannedWord" ("id", "word") VALUES
    (gen_random_uuid()::text, 'kurva'),
    (gen_random_uuid()::text, 'fasz'),
    (gen_random_uuid()::text, 'buzi'),
    (gen_random_uuid()::text, 'viagra'),
    (gen_random_uuid()::text, 'crypto giveaway')
ON CONFLICT ("word") DO NOTHING;

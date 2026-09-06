-- AlterTable
ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'egyeb';
ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

UPDATE "Streamer" SET "contactEmail" = "email" WHERE "contactEmail" IS NULL OR "contactEmail" = '';

ALTER TABLE "Streamer" ALTER COLUMN "contactEmail" SET NOT NULL;

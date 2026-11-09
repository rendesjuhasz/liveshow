ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "originalLocale" TEXT NOT NULL DEFAULT 'hu';
UPDATE "Show" SET "originalLocale" = 'hu' WHERE "originalLocale" IS NULL OR "originalLocale" = '';

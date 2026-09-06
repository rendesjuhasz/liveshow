-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
    "id" TEXT NOT NULL,
    "commissionPercent" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformConfig" ("id", "commissionPercent")
VALUES ('default', 20)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

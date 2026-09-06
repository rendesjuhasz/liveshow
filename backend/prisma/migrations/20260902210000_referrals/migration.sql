ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx" ON "User"("referredByUserId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'User_referredByUserId_fkey'
    ) THEN
        ALTER TABLE "User"
            ADD CONSTRAINT "User_referredByUserId_fkey"
            FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "TicketPackPurchase" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'purchase';

CREATE TABLE IF NOT EXISTS "Referral" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "qualifyingPurchaseTickets" INTEGER NOT NULL DEFAULT 0,
    "rewardTicketsGranted" INTEGER NOT NULL DEFAULT 0,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE INDEX IF NOT EXISTS "Referral_referrerUserId_status_idx" ON "Referral"("referrerUserId", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Referral_referrerUserId_fkey'
    ) THEN
        ALTER TABLE "Referral"
            ADD CONSTRAINT "Referral_referrerUserId_fkey"
            FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Referral_referredUserId_fkey'
    ) THEN
        ALTER TABLE "Referral"
            ADD CONSTRAINT "Referral_referredUserId_fkey"
            FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "minimumPurchasedTickets" INTEGER NOT NULL DEFAULT 10,
    "rewardTicketAmount" INTEGER NOT NULL DEFAULT 5,
    "allowMultipleFromReferrer" BOOLEAN NOT NULL DEFAULT TRUE,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReferralSettings"
    ("id", "enabled", "minimumPurchasedTickets", "rewardTicketAmount", "allowMultipleFromReferrer", "updatedAt")
VALUES ('default', TRUE, 10, 5, TRUE, NOW())
ON CONFLICT ("id") DO NOTHING;

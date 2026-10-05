ALTER TABLE "GiftClaim" ALTER COLUMN "ticketId" DROP NOT NULL;

ALTER TABLE "GiftClaim" ADD COLUMN IF NOT EXISTS "packPurchaseId" TEXT;

CREATE INDEX IF NOT EXISTS "GiftClaim_packPurchaseId_idx" ON "GiftClaim"("packPurchaseId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GiftClaim_packPurchaseId_fkey'
    ) THEN
        ALTER TABLE "GiftClaim"
            ADD CONSTRAINT "GiftClaim_packPurchaseId_fkey"
            FOREIGN KEY ("packPurchaseId") REFERENCES "TicketPackPurchase"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

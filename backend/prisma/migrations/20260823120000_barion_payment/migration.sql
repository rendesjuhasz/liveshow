ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "barionPaymentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_barionPaymentId_key" ON "Payment" ("barionPaymentId");

-- TOTP skeleton + explicit streamer account linking (no email auto-bind)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpPendingEnc" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpConfirmedAt" TIMESTAMP(3);

ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "linkTokenHash" TEXT;
ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "linkTokenExpiresAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordExpiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_resetPasswordTokenHash_idx" ON "User"("resetPasswordTokenHash");

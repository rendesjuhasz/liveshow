-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- CreateIndex (case-insensitive; multiple NULLs allowed)
DROP INDEX IF EXISTS "User_username_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_lower_key" ON "User" (LOWER("username")) WHERE "username" IS NOT NULL;

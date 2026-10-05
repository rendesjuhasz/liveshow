import type { PrismaService } from "../prisma/prisma.service";

export async function ensureOAuthSchema(prisma: PrismaService) {
    const stmts = [
        `ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'local'`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "microsoftId" TEXT`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appleId" TEXT`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginProvider" TEXT`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_microsoftId_key" ON "User"("microsoftId")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_appleId_key" ON "User"("appleId")`,
        `CREATE TABLE IF NOT EXISTS "AuthEvent" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            action TEXT NOT NULL,
            provider TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS "AuthEvent_userId_createdAt_idx" ON "AuthEvent"("userId", "createdAt")`,
    ];
    for (const sql of stmts) {
        await prisma.$executeRawUnsafe(sql).catch(() => undefined);
    }
}

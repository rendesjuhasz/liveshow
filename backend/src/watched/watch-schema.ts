import { PrismaService } from "../prisma/prisma.service";

export async function ensureWatchSchema(prisma: PrismaService) {
    const stmts = [
        `CREATE TABLE IF NOT EXISTS "ShowWatch" (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "watchedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("userId", "showId")
        )`,
        `CREATE INDEX IF NOT EXISTS "ShowWatch_userId_watchedAt_idx" ON "ShowWatch" ("userId", "watchedAt")`,
    ];
    for (const sql of stmts) {
        await prisma.$executeRawUnsafe(sql).catch(() => undefined);
    }
}

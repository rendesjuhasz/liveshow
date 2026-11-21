import { PrismaService } from "../prisma/prisma.service";

export async function ensureFavoriteSchema(prisma: PrismaService) {
    const stmts = [
        `CREATE TABLE IF NOT EXISTS "ShowFavorite" (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("userId", "showId")
        )`,
        `CREATE INDEX IF NOT EXISTS "ShowFavorite_userId_createdAt_idx" ON "ShowFavorite" ("userId", "createdAt")`,
    ];
    for (const sql of stmts) {
        await prisma.$executeRawUnsafe(sql).catch(() => undefined);
    }
}

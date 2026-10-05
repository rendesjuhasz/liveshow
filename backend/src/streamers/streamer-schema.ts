import type { PrismaService } from "../prisma/prisma.service";

export async function ensureStreamerPreflightColumns(prisma: PrismaService) {
    await prisma
        .$executeRawUnsafe(`ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "lastPreflightAt" TIMESTAMP(3)`)
        .catch(() => undefined);
    await prisma
        .$executeRawUnsafe(`ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "lastPreflightGrade" TEXT`)
        .catch(() => undefined);
        await prisma
            .$executeRawUnsafe(`ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "lastPreflightJson" JSONB`)
            .catch(() => undefined);
        await prisma
            .$executeRawUnsafe(`ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "linkTokenHash" TEXT`)
            .catch(() => undefined);
        await prisma
            .$executeRawUnsafe(`ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "linkTokenExpiresAt" TIMESTAMP(3)`)
            .catch(() => undefined);
    await prisma
        .$executeRawUnsafe(`ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "publicLinks" JSONB`)
        .catch(() => undefined);
}

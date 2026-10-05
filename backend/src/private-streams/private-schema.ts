import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { HLS_OUTPUT_ROOT } from "../streaming/hls-paths";

export const PRIVATE_DEADLINES = [
    { hours: 24, label: "24 órán belül" },
    { hours: 72, label: "3 napon belül" },
    { hours: 168, label: "1 héten belül" },
    { hours: 336, label: "2 héten belül" },
] as const;

export const DEFAULT_PRICE_BANDS = [
    { stars: 1, minPrice: 5000, maxPrice: 20000 },
    { stars: 2, minPrice: 10000, maxPrice: 35000 },
    { stars: 3, minPrice: 15000, maxPrice: 50000 },
    { stars: 4, minPrice: 25000, maxPrice: 80000 },
    { stars: 5, minPrice: 40000, maxPrice: 150000 },
] as const;

export const BACKUP_DAYS = 30;

export function backupRoot() {
    return path.join(HLS_OUTPUT_ROOT, "_private-backups");
}

export function starCategory(average: number) {
    const n = Math.round(Number(average) || 0);
    return Math.min(5, Math.max(1, n || 1));
}

export async function ensurePrivateSchema(prisma: PrismaService) {
    await prisma.$executeRawUnsafe(
        `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false`,
    ).catch(() => undefined);
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PrivatePriceBand" (
            "stars" INTEGER PRIMARY KEY,
            "minPrice" INTEGER NOT NULL,
            "maxPrice" INTEGER NOT NULL
        )
    `);
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PrivateRequest" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "topic" TEXT NOT NULL,
            "details" TEXT NOT NULL,
            "deadlineHours" INTEGER NOT NULL,
            "deadlineAt" TIMESTAMP(3) NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'open',
            "selectedOfferId" TEXT,
            "selectedStart" TIMESTAMP(3),
            "showId" TEXT,
            "ticketId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PrivateOffer" (
            "id" TEXT PRIMARY KEY,
            "requestId" TEXT NOT NULL,
            "streamerId" TEXT NOT NULL,
            "plan" TEXT NOT NULL,
            "price" INTEGER NOT NULL,
            "proposedStarts" TEXT NOT NULL,
            "starCategory" INTEGER NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PrivateBackup" (
            "id" TEXT PRIMARY KEY,
            "requestId" TEXT NOT NULL,
            "showId" TEXT,
            "filePath" TEXT NOT NULL,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
            await prisma.$executeRawUnsafe(
                `CREATE UNIQUE INDEX IF NOT EXISTS "PrivateOffer_request_streamer" ON "PrivateOffer"("requestId", "streamerId")`,
            ).catch(() => undefined);
            await prisma.$executeRawUnsafe(
                `CREATE UNIQUE INDEX IF NOT EXISTS "PrivateRequest_ticketId_key" ON "PrivateRequest" ("ticketId") WHERE "ticketId" IS NOT NULL`,
            ).catch(() => undefined);
            await prisma.$executeRawUnsafe(
                `CREATE UNIQUE INDEX IF NOT EXISTS "PrivateRequest_showId_key" ON "PrivateRequest" ("showId") WHERE "showId" IS NOT NULL`,
            ).catch(() => undefined);

    const count = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "PrivatePriceBand"`;
    if (!count[0]?.n) {
        for (const band of DEFAULT_PRICE_BANDS) {
            await prisma.$executeRaw`
                INSERT INTO "PrivatePriceBand" ("stars", "minPrice", "maxPrice")
                VALUES (${band.stars}, ${band.minPrice}, ${band.maxPrice})
                ON CONFLICT ("stars") DO NOTHING
            `;
        }
    }
}

export function newId() {
    return randomUUID();
}

export async function privateShowIds(prisma: PrismaService) {
    const flagged = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Show" WHERE "isPrivate" = true
    `.catch(() => [] as { id: string }[]);
    const linked = await prisma.$queryRaw<{ showId: string }[]>`
        SELECT DISTINCT "showId" FROM "PrivateRequest" WHERE "showId" IS NOT NULL
    `.catch(() => [] as { showId: string }[]);
    return new Set(
        [...flagged.map((row) => row.id), ...linked.map((row) => row.showId).filter(Boolean)],
    );
}

export function ensureBackupDir() {
    const dir = backupRoot();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

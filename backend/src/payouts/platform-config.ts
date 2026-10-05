import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_COMMISSION_PERCENT } from "./commission";
import { isPayoutCycle, type PayoutCycle } from "./payout-cycle";

export type PayoutSettings = {
    commissionPercent: number;
    streamerPercent: number;
    payoutCycle: PayoutCycle;
};

const SETTINGS_ID = "default";

export async function ensurePayoutSchema(prisma: PrismaService) {
    const stmts = [
        `CREATE TABLE IF NOT EXISTS "PlatformConfig" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "commissionPercent" INTEGER NOT NULL DEFAULT 20,
            "payoutCycle" TEXT NOT NULL DEFAULT 'monthly'
        )`,
        `ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "payoutCycle" TEXT NOT NULL DEFAULT 'monthly'`,
        `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "commissionPercent" INTEGER`,
        `ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`,
        `ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)`,
        `ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "method" TEXT`,
        `ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "snapshot" TEXT`,
        `ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "requestedBy" TEXT NOT NULL DEFAULT 'streamer'`,
        `ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "invoiceCapable" BOOLEAN NOT NULL DEFAULT FALSE`,
        `ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "taxDeclarationAcceptedAt" TIMESTAMP(3)`,
        `ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "contractShareAcceptedAt" TIMESTAMP(3)`,
        `ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "preferredPayoutMethod" TEXT`,
        `CREATE TABLE IF NOT EXISTS "PayoutEvent" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "payoutId" TEXT NOT NULL,
            "actorUserId" TEXT,
            "action" TEXT NOT NULL,
            "fromStatus" TEXT,
            "toStatus" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
    ];
    for (const sql of stmts) {
        await prisma.$executeRawUnsafe(sql).catch(() => undefined);
    }
    await prisma.$executeRaw`
        INSERT INTO "PlatformConfig" (id, "commissionPercent", "payoutCycle")
        VALUES (${SETTINGS_ID}, ${DEFAULT_COMMISSION_PERCENT}, 'monthly')
        ON CONFLICT (id) DO NOTHING
    `.catch(() => undefined);
}

export async function getPayoutSettings(prisma: PrismaService): Promise<PayoutSettings> {
    const rows = await prisma.$queryRaw<any[]>`
        SELECT "commissionPercent", "payoutCycle" FROM "PlatformConfig" WHERE id = ${SETTINGS_ID} LIMIT 1
    `.catch(() => []);
    const platform = Math.min(90, Math.max(0, Math.round(Number(rows[0]?.commissionPercent) || DEFAULT_COMMISSION_PERCENT)));
    const cycle = isPayoutCycle(String(rows[0]?.payoutCycle || ""))
        ? (String(rows[0].payoutCycle) as PayoutCycle)
        : "monthly";
    return {
        commissionPercent: platform,
        streamerPercent: 100 - platform,
        payoutCycle: cycle,
    };
}

export async function getCommissionPercent(prisma: PrismaService) {
    return (await getPayoutSettings(prisma)).commissionPercent;
}

export async function setPayoutSettings(
    prisma: PrismaService,
    body: { commissionPercent?: number; streamerPercent?: number; payoutCycle?: string },
) {
    const current = await getPayoutSettings(prisma);
    let platform = current.commissionPercent;
    if (body.commissionPercent !== undefined) {
        platform = Math.min(90, Math.max(0, Math.round(Number(body.commissionPercent))));
    } else if (body.streamerPercent !== undefined) {
        const streamer = Math.min(100, Math.max(10, Math.round(Number(body.streamerPercent))));
        platform = 100 - streamer;
    }
    const cycle = isPayoutCycle(String(body.payoutCycle || current.payoutCycle))
        ? String(body.payoutCycle || current.payoutCycle)
        : current.payoutCycle;
    await prisma.$executeRaw`
        INSERT INTO "PlatformConfig" (id, "commissionPercent", "payoutCycle")
        VALUES (${SETTINGS_ID}, ${platform}, ${cycle})
        ON CONFLICT (id) DO UPDATE SET
            "commissionPercent" = ${platform},
            "payoutCycle" = ${cycle}
    `;
    return getPayoutSettings(prisma);
}

export async function setCommissionPercent(prisma: PrismaService, percent: number) {
    const settings = await setPayoutSettings(prisma, { commissionPercent: percent });
    return settings.commissionPercent;
}

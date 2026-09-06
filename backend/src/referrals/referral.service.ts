import { randomBytes, randomUUID } from "crypto";
import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { canCreateReferral, REFERRAL_STATUSES, shouldGrantReward } from "./referral.rules";

export { REFERRAL_STATUSES } from "./referral.rules";

const SETTINGS_ID = "default";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ReferralSettingsRow = {
    enabled: boolean;
    minimumPurchasedTickets: number;
    rewardTicketAmount: number;
    allowMultipleFromReferrer: boolean;
    updatedAt?: Date;
};

@Injectable()
export class ReferralService implements OnModuleInit {
    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await this.ensureSchema();
        await this.backfillCodes();
    }

    async getSettings(): Promise<ReferralSettingsRow> {
        await this.ensureSchema();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "ReferralSettings" WHERE id = ${SETTINGS_ID} LIMIT 1
        `;
        const row = rows[0];
        return {
            enabled: row?.enabled !== false,
            minimumPurchasedTickets: Math.max(1, Number(row?.minimumPurchasedTickets) || 10),
            rewardTicketAmount: Math.max(1, Number(row?.rewardTicketAmount) || 5),
            allowMultipleFromReferrer: row?.allowMultipleFromReferrer !== false,
            updatedAt: row?.updatedAt,
        };
    }

    async updateSettings(body: {
        enabled?: boolean;
        minimumPurchasedTickets?: number;
        rewardTicketAmount?: number;
        allowMultipleFromReferrer?: boolean;
    }) {
        await this.ensureSchema();
        const current = await this.getSettings();
        const enabled = body.enabled === undefined ? current.enabled : Boolean(body.enabled);
        const minimum = body.minimumPurchasedTickets === undefined
            ? current.minimumPurchasedTickets
            : Math.max(1, Math.round(Number(body.minimumPurchasedTickets)));
        const reward = body.rewardTicketAmount === undefined
            ? current.rewardTicketAmount
            : Math.max(1, Math.round(Number(body.rewardTicketAmount)));
        const allowMultiple = body.allowMultipleFromReferrer === undefined
            ? current.allowMultipleFromReferrer
            : Boolean(body.allowMultipleFromReferrer);
        if (!Number.isFinite(minimum) || !Number.isFinite(reward)) {
            throw new BadRequestException("A jegy darabszám érvénytelen.");
        }
        await this.prisma.$executeRaw`
            UPDATE "ReferralSettings"
            SET enabled = ${enabled},
                "minimumPurchasedTickets" = ${minimum},
                "rewardTicketAmount" = ${reward},
                "allowMultipleFromReferrer" = ${allowMultiple},
                "updatedAt" = NOW()
            WHERE id = ${SETTINGS_ID}
        `;
        return this.getSettings();
    }

    async assignCode(userId: string) {
        await this.ensureSchema();
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT "referralCode" FROM "User" WHERE id = ${userId} LIMIT 1
        `;
        if (existing[0]?.referralCode) return String(existing[0].referralCode);
        for (let i = 0; i < 12; i++) {
            const code = this.makeCode();
            const clash = await this.prisma.$queryRaw<any[]>`
                SELECT id FROM "User" WHERE "referralCode" = ${code} LIMIT 1
            `;
            if (clash[0]) continue;
            await this.prisma.$executeRaw`
                UPDATE "User" SET "referralCode" = ${code} WHERE id = ${userId} AND "referralCode" IS NULL
            `;
            const saved = await this.prisma.$queryRaw<any[]>`
                SELECT "referralCode" FROM "User" WHERE id = ${userId} LIMIT 1
            `;
            if (saved[0]?.referralCode) return String(saved[0].referralCode);
        }
        throw new BadRequestException("Nem sikerült ajánlókódot kiállítani.");
    }

    async attachFromCode(newUserId: string, rawCode?: string | null) {
        const code = String(rawCode || "").trim().toUpperCase();
        if (!code) return null;
        await this.ensureSchema();
        const settings = await this.getSettings();
        if (!settings.enabled) return null;

        const referrers = await this.prisma.$queryRaw<any[]>`
            SELECT id, "referralCode" FROM "User" WHERE "referralCode" = ${code} LIMIT 1
        `;
        const referrer = referrers[0];
        if (!referrer) return null;
        if (referrer.id === newUserId) return null;

        const already = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "Referral" WHERE "referredUserId" = ${newUserId} LIMIT 1
        `;
        const existingForReferrer = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "Referral" WHERE "referrerUserId" = ${referrer.id} LIMIT 1
        `;
        if (
            !canCreateReferral({
                enabled: settings.enabled,
                referrerUserId: referrer.id,
                newUserId,
                alreadyReferred: Boolean(already[0]),
                allowMultipleFromReferrer: settings.allowMultipleFromReferrer,
                referrerAlreadyHasReferral: Boolean(existingForReferrer[0]),
            })
        ) {
            return null;
        }

        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "Referral"
                (id, "referrerUserId", "referredUserId", status, "qualifyingPurchaseTickets",
                 "rewardTicketsGranted", "createdAt")
            VALUES (${id}, ${referrer.id}, ${newUserId}, ${REFERRAL_STATUSES.PENDING}, 0, 0, NOW())
        `;
        await this.prisma.$executeRaw`
            UPDATE "User" SET "referredByUserId" = ${referrer.id} WHERE id = ${newUserId}
        `;
        return { id, referrerUserId: referrer.id };
    }

    async onPaidPurchase(referredUserId: string) {
        if (!referredUserId) return;
        try {
            await this.tryComplete(referredUserId);
        } catch (err) {
            console.error("Referral reward check failed:", (err as Error)?.message || err);
        }
    }

    async myOverview(userId: string) {
        const code = await this.assignCode(userId);
        const settings = await this.getSettings();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT r.id, r.status, r."qualifyingPurchaseTickets", r."rewardTicketsGranted",
                   r."rewardedAt", r."createdAt",
                   u.email AS "referredEmail", u.name AS "referredName"
            FROM "Referral" r
            JOIN "User" u ON u.id = r."referredUserId"
            WHERE r."referrerUserId" = ${userId}
            ORDER BY r."createdAt" DESC
        `;
        const successful = rows.filter((r) =>
            r.status === REFERRAL_STATUSES.COMPLETED || r.status === REFERRAL_STATUSES.REWARDED,
        ).length;
        const rewardTickets = rows.reduce(
            (sum, r) => sum + (Number(r.rewardTicketsGranted) || 0),
            0,
        );
        return {
            enabled: settings.enabled,
            referralCode: code,
            successfulReferrals: successful,
            totalRewardTickets: rewardTickets,
            minimumPurchasedTickets: settings.minimumPurchasedTickets,
            rewardTicketAmount: settings.rewardTicketAmount,
            history: rows.map((r) => ({
                id: r.id,
                status: r.status,
                referredName: String(r.referredName || "").trim() || "Néző",
                qualifyingPurchaseTickets: r.qualifyingPurchaseTickets,
                rewardTicketsGranted: r.rewardTicketsGranted,
                rewardedAt: r.rewardedAt,
                createdAt: r.createdAt,
            })),
        };
    }

    async adminList() {
        await this.ensureSchema();
        return this.prisma.$queryRaw<any[]>`
            SELECT r.id, r.status, r."qualifyingPurchaseTickets", r."rewardTicketsGranted",
                   r."rewardedAt", r."createdAt",
                   a.email AS "referrerEmail", a.name AS "referrerName",
                   b.email AS "referredEmail", b.name AS "referredName"
            FROM "Referral" r
            JOIN "User" a ON a.id = r."referrerUserId"
            JOIN "User" b ON b.id = r."referredUserId"
            ORDER BY r."createdAt" DESC
            LIMIT 200
        `;
    }

    async adminStats() {
        await this.ensureSchema();
        const counts = (
            await this.prisma.$queryRaw<any[]>`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status IN ('completed', 'rewarded'))::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'rewarded')::int AS rewarded,
                    COALESCE(SUM("rewardTicketsGranted"), 0)::int AS "rewardTickets"
                FROM "Referral"
            `
        )[0] || { total: 0, completed: 0, rewarded: 0, rewardTickets: 0 };
        return {
            total: counts.total || 0,
            completed: counts.completed || 0,
            rewarded: counts.rewarded || 0,
            rewardTicketsIssued: counts.rewardTickets || 0,
            settings: await this.getSettings(),
        };
    }

    async giftTicketStats() {
        await this.ensureSchema();
        const claims = await this.prisma.$queryRaw<any[]>`
            SELECT source, COUNT(*)::int AS tickets
            FROM "GiftClaim"
            GROUP BY source
        `.catch(() => []);
        const bySource: Record<string, number> = {};
        let claimTickets = 0;
        for (const row of claims) {
            const n = Number(row.tickets) || 0;
            bySource[String(row.source || "other")] = n;
            claimTickets += n;
        }
        const referralPacks = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COALESCE(SUM("ticketCount"), 0)::int AS tickets,
                       COUNT(*)::int AS packs
                FROM "TicketPackPurchase"
                WHERE status = 'paid' AND COALESCE(source, 'purchase') = 'referral'
            `.catch(() => [{ tickets: 0, packs: 0 }])
        )[0] || { tickets: 0, packs: 0 };
        const giftPacks = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COALESCE(SUM("ticketCount"), 0)::int AS tickets
                FROM "TicketPackPurchase"
                WHERE status = 'paid' AND COALESCE(source, 'purchase') = 'gift'
            `.catch(() => [{ tickets: 0 }])
        )[0] || { tickets: 0 };
        const campaignTickets = (bySource.first_users || 0) + (bySource.first_buyers || 0);
        const adminTickets = bySource.admin_gift || 0;
        const referralTickets = Number(referralPacks.tickets) || 0;
        const extraGiftPacks = Number(giftPacks.tickets) || 0;
        return {
            campaignClaims: campaignTickets,
            adminGiftTickets: adminTickets,
            otherClaimTickets: claimTickets - campaignTickets - adminTickets,
            referralRewardTickets: referralTickets,
            referralRewardPacks: Number(referralPacks.packs) || 0,
            otherGiftPackTickets: extraGiftPacks,
            totalGiftTicketsIssued: claimTickets + referralTickets + extraGiftPacks,
        };
    }

    private async tryComplete(referredUserId: string) {
        await this.ensureSchema();
        const settings = await this.getSettings();
        if (!settings.enabled) return;

        await this.prisma.$transaction(async (tx) => {
            const refs = await tx.$queryRaw<any[]>`
                SELECT * FROM "Referral" WHERE "referredUserId" = ${referredUserId} FOR UPDATE
            `;
            const referral = refs[0];
            if (!referral) return;

            const purchased = (
                await tx.$queryRaw<any[]>`
                    SELECT COALESCE(SUM("ticketCount"), 0)::int AS tickets
                    FROM "TicketPackPurchase"
                    WHERE "userId" = ${referredUserId}
                      AND status = 'paid'
                      AND COALESCE(price, 0) > 0
                      AND COALESCE(source, 'purchase') = 'purchase'
                `
            )[0]?.tickets || 0;

            await tx.$executeRaw`
                UPDATE "Referral"
                SET "qualifyingPurchaseTickets" = ${purchased}
                WHERE id = ${referral.id}
            `;

            if (!shouldGrantReward(referral.status, purchased, settings.minimumPurchasedTickets)) {
                return;
            }

            await tx.$executeRaw`
                UPDATE "Referral"
                SET status = ${REFERRAL_STATUSES.COMPLETED}
                WHERE id = ${referral.id} AND status = ${REFERRAL_STATUSES.PENDING}
            `;

            const reward = settings.rewardTicketAmount;
            const packId = randomUUID();
            await tx.$executeRaw`
                INSERT INTO "TicketPackPurchase"
                    (id, "userId", "groupKey", "groupName", "ticketCount", price, "unitValue",
                     "remainingCount", status, source, "paidAt", "createdAt")
                VALUES (
                    ${packId},
                    ${referral.referrerUserId},
                    'referral',
                    'Ajánló jutalom',
                    ${reward},
                    0,
                    0,
                    ${reward},
                    'paid',
                    'referral',
                    NOW(),
                    NOW()
                )
            `;
            await tx.$executeRaw`
                UPDATE "Referral"
                SET status = ${REFERRAL_STATUSES.REWARDED},
                    "rewardTicketsGranted" = ${reward},
                    "rewardedAt" = NOW()
                WHERE id = ${referral.id}
            `;
        });
    }

    makeCode(length = 6) {
        const bytes = randomBytes(length);
        let out = "";
        for (let i = 0; i < length; i++) {
            out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
        }
        return out;
    }

    private async backfillCodes() {
        const missing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "User" WHERE "referralCode" IS NULL LIMIT 200
        `.catch(() => []);
        for (const row of missing) {
            await this.assignCode(row.id).catch(() => undefined);
        }
    }

    private async ensureSchema() {
        const stmts = [
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT`,
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT`,
            `ALTER TABLE "TicketPackPurchase" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'purchase'`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode")`,
            `CREATE TABLE IF NOT EXISTS "Referral" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "referrerUserId" TEXT NOT NULL,
                "referredUserId" TEXT NOT NULL,
                "status" TEXT NOT NULL DEFAULT 'pending',
                "qualifyingPurchaseTickets" INTEGER NOT NULL DEFAULT 0,
                "rewardTicketsGranted" INTEGER NOT NULL DEFAULT 0,
                "rewardedAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "Referral_referredUserId_key" ON "Referral"("referredUserId")`,
            `CREATE INDEX IF NOT EXISTS "Referral_referrerUserId_status_idx" ON "Referral"("referrerUserId", "status")`,
            `CREATE TABLE IF NOT EXISTS "ReferralSettings" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
                "minimumPurchasedTickets" INTEGER NOT NULL DEFAULT 10,
                "rewardTicketAmount" INTEGER NOT NULL DEFAULT 5,
                "allowMultipleFromReferrer" BOOLEAN NOT NULL DEFAULT TRUE,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
        await this.prisma.$executeRawUnsafe(`
            INSERT INTO "ReferralSettings"
                ("id", "enabled", "minimumPurchasedTickets", "rewardTicketAmount",
                 "allowMultipleFromReferrer", "updatedAt")
            VALUES ('default', TRUE, 10, 5, TRUE, NOW())
            ON CONFLICT ("id") DO NOTHING
        `).catch(() => undefined);
    }
}

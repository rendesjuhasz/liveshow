import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { TicketGroupsService } from "./ticket-groups.service";

export const CAMPAIGN_TYPES = {
    FIRST_USERS: "first_users",
    FIRST_BUYERS: "first_buyers",
} as const;

const CAMPAIGN_STATUSES = ["draft", "active", "paused", "ended"] as const;
const MAX_CAMPAIGN_TICKETS = 10_000;

export function parseCampaignTicketCount(value: unknown, fallback = 1) {
    const n = Math.round(Number(value ?? fallback));
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(MAX_CAMPAIGN_TICKETS, n);
}

@Injectable()
export class GiftCampaignsService implements OnModuleInit {
    private readonly logger = new Logger(GiftCampaignsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly groups: TicketGroupsService,
        private readonly mail: MailService,
    ) {}

    async onModuleInit() {
        await this.ensureTables().catch((err) =>
            this.logger.warn(`Ajándék kampány táblák: ${err?.message || err}`),
        );
    }

    async ensureTables() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "GiftCampaign" (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                "showId" TEXT NOT NULL REFERENCES "Show"(id) ON DELETE CASCADE,
                "ticketCount" INTEGER NOT NULL DEFAULT 1,
                "maxClaims" INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                "startsAt" TIMESTAMP(3),
                "endsAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "GiftClaim" (
                id TEXT PRIMARY KEY,
                "campaignId" TEXT REFERENCES "GiftCampaign"(id) ON DELETE SET NULL,
                "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
                "ticketId" TEXT REFERENCES "Ticket"(id) ON DELETE CASCADE,
                source TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await this.prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "GiftClaim_campaign_user"
            ON "GiftClaim" ("campaignId", "userId")
            WHERE "campaignId" IS NOT NULL
        `);
        await this.prisma.$executeRawUnsafe(`
            ALTER TABLE "GiftClaim" ALTER COLUMN "ticketId" DROP NOT NULL
        `);
        await this.prisma.$executeRawUnsafe(`
            ALTER TABLE "GiftClaim" ADD COLUMN IF NOT EXISTS "packPurchaseId" TEXT
        `);
        await this.prisma.$executeRawUnsafe(`
            ALTER TABLE "GiftCampaign" ADD COLUMN IF NOT EXISTS "ticketCount" INTEGER NOT NULL DEFAULT 1
        `);
        await this.prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "GiftClaim_first_users_user"
            ON "GiftClaim" ("userId")
            WHERE source = 'first_users'
        `);
        await this.prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "GiftClaim_first_buyers_user"
            ON "GiftClaim" ("userId")
            WHERE source = 'first_buyers'
        `);
    }

    async list() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT c.*,
                   s.title AS "showTitle",
                   (SELECT COUNT(*)::int FROM "GiftClaim" g WHERE g."campaignId" = c.id) AS "claimCount"
            FROM "GiftCampaign" c
            JOIN "Show" s ON s.id = c."showId"
            ORDER BY c."createdAt" DESC
        `;
        return rows.map((row) => this.toCampaign(row));
    }

    async getById(id: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT c.*,
                   s.title AS "showTitle",
                   (SELECT COUNT(*)::int FROM "GiftClaim" g WHERE g."campaignId" = c.id) AS "claimCount"
            FROM "GiftCampaign" c
            JOIN "Show" s ON s.id = c."showId"
            WHERE c.id = ${id}
        `;
        if (!rows[0]) throw new NotFoundException("A kampány nem található.");
        const claims = await this.prisma.$queryRaw<any[]>`
            SELECT g.id, g.source, g."createdAt", g."ticketId", g."packPurchaseId",
                   u.email AS "userEmail", u.id AS "userId"
            FROM "GiftClaim" g
            JOIN "User" u ON u.id = g."userId"
            WHERE g."campaignId" = ${id}
            ORDER BY g."createdAt" DESC
        `;
        return { ...this.toCampaign(rows[0]), claims };
    }

    async create(body: {
        name?: string;
        type?: string;
        showId?: string;
        ticketCount?: number;
        maxClaims?: number;
        status?: string;
        startsAt?: string | null;
        endsAt?: string | null;
    }) {
        const name = String(body.name || "").trim();
        if (!name) throw new BadRequestException("A kampány neve kötelező.");
        const type = this.parseType(body.type);
        const showId = String(body.showId || "").trim();
        if (!showId) throw new BadRequestException("A műsor kötelező.");
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        if (!show) throw new NotFoundException("A műsor nem található.");
        const ticketCount = parseCampaignTicketCount(body.ticketCount, 1);
        if (Math.round(Number(body.ticketCount ?? 1)) !== ticketCount) {
            throw new BadRequestException("A kérdésjegy darabszám 1 és 10000 között legyen.");
        }
        const maxClaims = Math.round(Number(body.maxClaims));
        if (!Number.isFinite(maxClaims) || maxClaims < 1) {
            throw new BadRequestException("Az ingyenjegyek száma legalább 1 legyen.");
        }
        const status = this.parseStatus(body.status || "draft");
        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "GiftCampaign"
                (id, name, type, "showId", "ticketCount", "maxClaims", status, "startsAt", "endsAt")
            VALUES
                (${id}, ${name}, ${type}, ${showId}, ${ticketCount}, ${maxClaims}, ${status},
                 ${this.parseDate(body.startsAt)}, ${this.parseDate(body.endsAt)})
        `;
        return this.getById(id);
    }

    async update(
        id: string,
        body: {
            name?: string;
            maxClaims?: number;
            status?: string;
            startsAt?: string | null;
            endsAt?: string | null;
            ticketCount?: number;
        },
    ) {
        const current = await this.getById(id);
        const name = body.name !== undefined ? String(body.name).trim() : current.name;
        if (!name) throw new BadRequestException("A kampány neve kötelező.");
        const maxClaims =
            body.maxClaims !== undefined ? Math.round(Number(body.maxClaims)) : current.maxClaims;
        if (!Number.isFinite(maxClaims) || maxClaims < 1) {
            throw new BadRequestException("Az ingyenjegyek száma legalább 1 legyen.");
        }
        const status = body.status !== undefined ? this.parseStatus(body.status) : current.status;
        const ticketCount =
            body.ticketCount !== undefined
                ? parseCampaignTicketCount(body.ticketCount, current.ticketCount)
                : current.ticketCount;
        if (body.ticketCount !== undefined && Math.round(Number(body.ticketCount)) !== ticketCount) {
            throw new BadRequestException("A kérdésjegy darabszám 1 és 10000 között legyen.");
        }
        const startsAt =
            body.startsAt !== undefined ? this.parseDate(body.startsAt) : current.startsAt;
        const endsAt = body.endsAt !== undefined ? this.parseDate(body.endsAt) : current.endsAt;
        await this.prisma.$executeRaw`
            UPDATE "GiftCampaign"
            SET name = ${name},
                "maxClaims" = ${maxClaims},
                status = ${status},
                "ticketCount" = ${ticketCount},
                "startsAt" = ${startsAt},
                "endsAt" = ${endsAt}
            WHERE id = ${id}
        `;
        return this.getById(id);
    }

    toPublicPromo(row: any) {
        if (!row) return null;
        const campaign = this.toCampaign(row);
        const remaining = Math.max(0, campaign.maxClaims - campaign.claimCount);
        if (remaining <= 0) return null;
        const who = campaign.type === CAMPAIGN_TYPES.FIRST_USERS ? "regisztráló felhasználó" : "vásárló";
        return {
            campaignId: campaign.id,
            name: campaign.name,
            type: campaign.type,
            maxClaims: campaign.maxClaims,
            remaining,
            ticketCount: campaign.ticketCount,
            message: `Kampány: az első ${campaign.maxClaims} ${who} ${campaign.ticketCount} kérdésjegyet kap. Még ${remaining} hely van.`,
        };
    }

    async publicPromo(showId: string) {
        const map = await this.publicPromos([showId]);
        return map.get(String(showId || "").trim()) ?? null;
    }

    async publicPromos(showIds: string[]) {
        const ids = [...new Set(showIds.map((id) => String(id || "").trim()).filter(Boolean))];
        const out = new Map<string, ReturnType<GiftCampaignsService["toPublicPromo"]>>();
        if (!ids.length) return out;
        const now = new Date();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT DISTINCT ON (c."showId") c.*,
                   (SELECT COUNT(*)::int FROM "GiftClaim" g WHERE g."campaignId" = c.id) AS "claimCount"
            FROM "GiftCampaign" c
            WHERE c."showId" IN (${Prisma.join(ids)})
              AND c.status = 'active'
              AND (c."startsAt" IS NULL OR c."startsAt" <= ${now})
              AND (c."endsAt" IS NULL OR c."endsAt" >= ${now})
            ORDER BY c."showId", c."createdAt" DESC
        `;
        for (const row of rows) {
            const promo = this.toPublicPromo(row);
            if (promo) out.set(String(row.showId), promo);
        }
        return out;
    }

    async tryClaimFirstUsers(userId: string) {
        try {
            if (await this.hasFirstUsersClaim(this.prisma, userId)) return [];
            const now = new Date();
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT c.*
                FROM "GiftCampaign" c
                WHERE c.type = ${CAMPAIGN_TYPES.FIRST_USERS}
                  AND c.status = 'active'
                  AND (c."startsAt" IS NULL OR c."startsAt" <= ${now})
                  AND (c."endsAt" IS NULL OR c."endsAt" >= ${now})
                ORDER BY c."createdAt" ASC
            `;
            for (const row of rows) {
                const result = await this.claimIfAvailable(row, userId, CAMPAIGN_TYPES.FIRST_USERS);
                if (result) return [result];
            }
            return [];
        } catch (err: any) {
            this.logger.warn(`Első felhasználós kampány: ${err?.message || err}`);
            return [];
        }
    }

    async tryClaimFirstBuyers(userId: string) {
        try {
            if (await this.hasFirstBuyersClaim(this.prisma, userId)) return [];
            const now = new Date();
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT c.*
                FROM "GiftCampaign" c
                WHERE c.type = ${CAMPAIGN_TYPES.FIRST_BUYERS}
                  AND c.status = 'active'
                  AND (c."startsAt" IS NULL OR c."startsAt" <= ${now})
                  AND (c."endsAt" IS NULL OR c."endsAt" >= ${now})
                ORDER BY c."createdAt" ASC
            `;
            for (const row of rows) {
                const result = await this.claimIfAvailable(row, userId, CAMPAIGN_TYPES.FIRST_BUYERS);
                if (result) return [result];
            }
            return [];
        } catch (err: any) {
            this.logger.warn(`Első vásárlós kampány: ${err?.message || err}`);
            return [];
        }
    }

    async logAdminGift(
        userId: string,
        ticketId?: string | null,
        campaignId?: string | null,
        packPurchaseId?: string | null,
    ) {
        const ticket = String(ticketId || "").trim() || null;
        const pack = String(packPurchaseId || "").trim() || null;
        if (!ticket && !pack) {
            throw new BadRequestException("A naplóhoz jegy vagy jegycsomag azonosító kell.");
        }
        await this.prisma.$executeRaw`
            INSERT INTO "GiftClaim" (id, "campaignId", "userId", "ticketId", "packPurchaseId", source)
            VALUES (
                ${randomUUID()},
                ${campaignId || null},
                ${userId},
                ${ticket},
                ${pack},
                ${"admin_gift"}
            )
        `;
    }

    private async hasFirstUsersClaim(
        db: { $queryRaw: PrismaService["$queryRaw"] },
        userId: string,
    ) {
        const rows = await db.$queryRaw<any[]>`
            SELECT g.id
            FROM "GiftClaim" g
            LEFT JOIN "GiftCampaign" c ON c.id = g."campaignId"
            WHERE g."userId" = ${userId}
              AND (g.source = ${CAMPAIGN_TYPES.FIRST_USERS} OR c.type = ${CAMPAIGN_TYPES.FIRST_USERS})
            LIMIT 1
        `;
        return Boolean(rows[0]?.id);
    }

    private async hasFirstBuyersClaim(
        db: { $queryRaw: PrismaService["$queryRaw"] },
        userId: string,
    ) {
        const rows = await db.$queryRaw<any[]>`
            SELECT g.id
            FROM "GiftClaim" g
            LEFT JOIN "GiftCampaign" c ON c.id = g."campaignId"
            WHERE g."userId" = ${userId}
              AND (g.source = ${CAMPAIGN_TYPES.FIRST_BUYERS} OR c.type = ${CAMPAIGN_TYPES.FIRST_BUYERS})
            LIMIT 1
        `;
        return Boolean(rows[0]?.id);
    }

    private async claimIfAvailable(campaign: any, userId: string, source: string) {
        const result = await this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw<any[]>`
                SELECT * FROM "GiftCampaign" WHERE id = ${campaign.id} FOR UPDATE
            `;
            const row = locked[0];
            if (!row || row.status !== "active") return null;

            const existingClaim = await tx.$queryRaw<any[]>`
                SELECT id FROM "GiftClaim"
                WHERE "campaignId" = ${row.id} AND "userId" = ${userId}
                LIMIT 1
            `;
            if (existingClaim[0]) return null;

            if (source === CAMPAIGN_TYPES.FIRST_USERS && (await this.hasFirstUsersClaim(tx, userId))) {
                return null;
            }
            if (source === CAMPAIGN_TYPES.FIRST_BUYERS && (await this.hasFirstBuyersClaim(tx, userId))) {
                return null;
            }

            const counts = await tx.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS n FROM "GiftClaim" WHERE "campaignId" = ${row.id}
            `;
            if ((counts[0]?.n || 0) >= row.maxClaims) return null;

            const ticketCount = parseCampaignTicketCount(row.ticketCount, 1);
            const granted = await this.groups.grantGiftUnits({
                userId,
                ticketCount,
                source: "gift",
                groupName: String(row.name || "Kampány kérdésjegy"),
                tx,
                skipMail: true,
            });

            await tx.$executeRaw`
                INSERT INTO "GiftClaim" (id, "campaignId", "userId", "ticketId", "packPurchaseId", source)
                VALUES (
                    ${randomUUID()},
                    ${row.id},
                    ${userId},
                    ${null},
                    ${granted.purchaseId},
                    ${source}
                )
            `;

            return {
                campaignGranted: true,
                campaignId: row.id,
                campaignName: row.name,
                ticketCount: granted.ticketCount,
                packPurchaseId: granted.purchaseId,
                groupName: granted.groupName,
                message:
                    source === CAMPAIGN_TYPES.FIRST_USERS
                        ? `Kérdésjegyet kaptál (első ${row.maxClaims} felhasználó): ${granted.ticketCount} db.`
                        : `Kérdésjegyet kaptál (első ${row.maxClaims} vásárló): ${granted.ticketCount} db.`,
            };
        });
        if (result?.packPurchaseId) {
            void this.mail.packPurchased(
                userId,
                result.groupName,
                result.ticketCount,
                result.packPurchaseId,
            );
        }
        return result;
    }

    private toCampaign(row: any) {
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            typeLabel:
                row.type === CAMPAIGN_TYPES.FIRST_USERS ? "Első X felhasználó" : "Első X vásárló",
            showId: row.showId,
            showTitle: row.showTitle || null,
            ticketCount: parseCampaignTicketCount(row.ticketCount, 1),
            maxClaims: Number(row.maxClaims),
            claimCount: Number(row.claimCount || 0),
            remaining: Math.max(0, Number(row.maxClaims) - Number(row.claimCount || 0)),
            status: row.status,
            statusLabel: this.statusLabel(row.status),
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            createdAt: row.createdAt,
        };
    }

    private statusLabel(status: string) {
        switch (status) {
            case "active":
                return "Aktív";
            case "paused":
                return "Szünetel";
            case "ended":
                return "Lezárva";
            default:
                return "Piszkozat";
        }
    }

    private parseType(type?: string) {
        const value = String(type || "").trim();
        if (value === CAMPAIGN_TYPES.FIRST_USERS || value === CAMPAIGN_TYPES.FIRST_BUYERS) {
            return value;
        }
        throw new BadRequestException(
            "A kampány típusa first_users (első X felhasználó) vagy first_buyers (első X vásárló) lehet.",
        );
    }

    private parseStatus(status?: string) {
        const value = String(status || "draft").trim();
        if (!(CAMPAIGN_STATUSES as readonly string[]).includes(value)) {
            throw new BadRequestException("Érvénytelen kampány státusz.");
        }
        return value;
    }

    private parseDate(value?: string | Date | null) {
        if (value === undefined || value === null || value === "") return null;
        const d = value instanceof Date ? value : new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
}

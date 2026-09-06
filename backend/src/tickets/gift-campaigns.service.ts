import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { TicketCategoriesService } from "./ticket-categories.service";
import { isTicketCategoryKey } from "./ticket-categories";
import { isTicketActive, TICKET_STATUSES } from "./ticket-status";

export const CAMPAIGN_TYPES = {
    FIRST_USERS: "first_users",
    FIRST_BUYERS: "first_buyers",
} as const;

const CAMPAIGN_STATUSES = ["draft", "active", "paused", "ended"] as const;

@Injectable()
export class GiftCampaignsService implements OnModuleInit {
    private readonly logger = new Logger(GiftCampaignsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly categories: TicketCategoriesService,
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
                "categoryKey" TEXT NOT NULL DEFAULT 'nezo',
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
                "ticketId" TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
                source TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await this.prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "GiftClaim_campaign_user"
            ON "GiftClaim" ("campaignId", "userId")
            WHERE "campaignId" IS NOT NULL
        `);
    }

    async list() {
        await this.ensureTables();
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
        await this.ensureTables();
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
            SELECT g.id, g.source, g."createdAt", g."ticketId",
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
        categoryKey?: string;
        maxClaims?: number;
        status?: string;
        startsAt?: string | null;
        endsAt?: string | null;
    }) {
        await this.ensureTables();
        const name = String(body.name || "").trim();
        if (!name) throw new BadRequestException("A kampány neve kötelező.");
        const type = this.parseType(body.type);
        const showId = String(body.showId || "").trim();
        if (!showId) throw new BadRequestException("A műsor kötelező.");
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        if (!show) throw new NotFoundException("A műsor nem található.");
        const categoryKey = this.parseCategory(body.categoryKey);
        await this.categories.assertOffered(showId, categoryKey);
        const maxClaims = Math.round(Number(body.maxClaims));
        if (!Number.isFinite(maxClaims) || maxClaims < 1) {
            throw new BadRequestException("Az ingyenjegyek száma legalább 1 legyen.");
        }
        const status = this.parseStatus(body.status || "draft");
        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "GiftCampaign"
                (id, name, type, "showId", "categoryKey", "maxClaims", status, "startsAt", "endsAt")
            VALUES
                (${id}, ${name}, ${type}, ${showId}, ${categoryKey}, ${maxClaims}, ${status},
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
            categoryKey?: string;
        },
    ) {
        await this.ensureTables();
        const current = await this.getById(id);
        const name = body.name !== undefined ? String(body.name).trim() : current.name;
        if (!name) throw new BadRequestException("A kampány neve kötelező.");
        const maxClaims =
            body.maxClaims !== undefined ? Math.round(Number(body.maxClaims)) : current.maxClaims;
        if (!Number.isFinite(maxClaims) || maxClaims < 1) {
            throw new BadRequestException("Az ingyenjegyek száma legalább 1 legyen.");
        }
        const status = body.status !== undefined ? this.parseStatus(body.status) : current.status;
        const categoryKey =
            body.categoryKey !== undefined
                ? this.parseCategory(body.categoryKey)
                : current.categoryKey;
        if (body.categoryKey !== undefined) {
            await this.categories.assertOffered(current.showId, categoryKey);
        }
        const startsAt =
            body.startsAt !== undefined ? this.parseDate(body.startsAt) : current.startsAt;
        const endsAt = body.endsAt !== undefined ? this.parseDate(body.endsAt) : current.endsAt;
        await this.prisma.$executeRaw`
            UPDATE "GiftCampaign"
            SET name = ${name},
                "maxClaims" = ${maxClaims},
                status = ${status},
                "categoryKey" = ${categoryKey},
                "startsAt" = ${startsAt},
                "endsAt" = ${endsAt}
            WHERE id = ${id}
        `;
        return this.getById(id);
    }

    async publicPromo(showId: string) {
        await this.ensureTables();
        const now = new Date();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT c.*,
                   (SELECT COUNT(*)::int FROM "GiftClaim" g WHERE g."campaignId" = c.id) AS "claimCount"
            FROM "GiftCampaign" c
            WHERE c."showId" = ${showId}
              AND c.status = 'active'
              AND (c."startsAt" IS NULL OR c."startsAt" <= ${now})
              AND (c."endsAt" IS NULL OR c."endsAt" >= ${now})
            ORDER BY c."createdAt" DESC
            LIMIT 1
        `;
        if (!rows[0]) return null;
        const campaign = this.toCampaign(rows[0]);
        const remaining = Math.max(0, campaign.maxClaims - campaign.claimCount);
        if (remaining <= 0) return null;
        const who = campaign.type === CAMPAIGN_TYPES.FIRST_USERS ? "regisztráló felhasználó" : "vásárló";
        return {
            campaignId: campaign.id,
            name: campaign.name,
            type: campaign.type,
            maxClaims: campaign.maxClaims,
            remaining,
            categoryKey: campaign.categoryKey,
            message: `Kampány: az első ${campaign.maxClaims} ${who} ingyenjegyet kap. Még ${remaining} hely van.`,
        };
    }

    async tryClaimFirstUsers(userId: string) {
        try {
            await this.ensureTables();
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
            const granted: any[] = [];
            for (const row of rows) {
                const result = await this.claimIfAvailable(row, userId, CAMPAIGN_TYPES.FIRST_USERS);
                if (result) granted.push(result);
            }
            return granted;
        } catch (err: any) {
            this.logger.warn(`Első felhasználós kampány: ${err?.message || err}`);
            return [];
        }
    }

    async tryClaimFirstBuyers(userId: string, showId: string) {
        try {
            await this.ensureTables();
            const now = new Date();
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT c.*
                FROM "GiftCampaign" c
                WHERE c.type = ${CAMPAIGN_TYPES.FIRST_BUYERS}
                  AND c."showId" = ${showId}
                  AND c.status = 'active'
                  AND (c."startsAt" IS NULL OR c."startsAt" <= ${now})
                  AND (c."endsAt" IS NULL OR c."endsAt" >= ${now})
                ORDER BY c."createdAt" ASC
                LIMIT 1
            `;
            if (!rows[0]) return null;
            return this.claimIfAvailable(rows[0], userId, CAMPAIGN_TYPES.FIRST_BUYERS);
        } catch (err: any) {
            this.logger.warn(`Első vásárlós kampány: ${err?.message || err}`);
            return null;
        }
    }

    async logAdminGift(userId: string, ticketId: string, campaignId?: string | null) {
        await this.ensureTables();
        await this.prisma.$executeRaw`
            INSERT INTO "GiftClaim" (id, "campaignId", "userId", "ticketId", source)
            VALUES (${randomUUID()}, ${campaignId || null}, ${userId}, ${ticketId}, ${"admin_gift"})
        `;
    }

    private async claimIfAvailable(campaign: any, userId: string, source: string) {
        return this.prisma.$transaction(async (tx) => {
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

            const counts = await tx.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS n FROM "GiftClaim" WHERE "campaignId" = ${row.id}
            `;
            if ((counts[0]?.n || 0) >= row.maxClaims) return null;

            const existingTicket = await tx.ticket.findUnique({
                where: { userId_showId: { userId, showId: row.showId } },
            });
            if (existingTicket && isTicketActive(existingTicket.status)) return null;

            const category = await this.categories.assertOffered(row.showId, row.categoryKey);
            const ticket = existingTicket
                ? await tx.ticket.update({
                      where: { id: existingTicket.id },
                      data: {
                          status: TICKET_STATUSES.ACTIVE,
                          price: 0,
                          categoryId: category.id,
                      },
                      include: { show: true, category: true },
                  })
                : await tx.ticket.create({
                      data: {
                          userId,
                          showId: row.showId,
                          categoryId: category.id,
                          price: 0,
                          status: TICKET_STATUSES.ACTIVE,
                      },
                      include: { show: true, category: true },
                  });

            await tx.payment.create({
                data: {
                    userId,
                    ticketId: ticket.id,
                    amount: 0,
                    status: "paid",
                    provider: "gift",
                },
            });

            await tx.$executeRaw`
                INSERT INTO "GiftClaim" (id, "campaignId", "userId", "ticketId", source)
                VALUES (${randomUUID()}, ${row.id}, ${userId}, ${ticket.id}, ${source})
            `;

            void this.mail.ticketPurchased(ticket.id);
            return {
                campaignGranted: true,
                campaignId: row.id,
                campaignName: row.name,
                message:
                    source === CAMPAIGN_TYPES.FIRST_USERS
                        ? `Ingyenjegyet kaptál a(z) „${ticket.show?.title || "műsor"}” adásra (első ${row.maxClaims} felhasználó).`
                        : `Ingyenjegyet kaptál: az első ${row.maxClaims} vásárló között vagy.`,
                alreadyOwned: false,
                ticket,
            };
        });
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
            categoryKey: row.categoryKey,
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

    private parseCategory(key?: string) {
        const value = String(key || "nezo").trim();
        if (!isTicketCategoryKey(value)) {
            throw new BadRequestException("Érvénytelen jegykategória.");
        }
        return value;
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

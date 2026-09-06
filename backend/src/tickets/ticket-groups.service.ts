import { randomUUID } from "crypto";
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { emptyGroupStats, ticketGroupByKey, TICKET_GROUPS } from "./ticket-groups";

@Injectable()
export class TicketGroupsService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly payments: PaymentsService,
    ) {}

    async onModuleInit() {
        await this.ensureSchema();
    }

    async listCatalog() {
        await this.ensureSchema();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT "key", name, "ticketCount", price, "unitValue", "sortOrder"
            FROM "TicketPackGroup"
            ORDER BY "sortOrder" ASC, name ASC
        `;
        return rows.map((g) => ({
            key: g.key,
            name: g.name,
            ticketCount: Number(g.ticketCount),
            price: Number(g.price),
            unitValue: Number(g.unitValue),
            unitLabel: `${Number(g.unitValue)} Ft/jegy`,
        }));
    }

    async saveCatalog(
        items: { key?: string; name?: string; ticketCount?: number; price?: number }[],
    ) {
        await this.ensureSchema();
        if (!Array.isArray(items) || items.length !== TICKET_GROUPS.length) {
            throw new BadRequestException("Mind a 4 jegycsomagot meg kell adni (Alap, Ezüst, Arany, Gyémánt).");
        }
        const seen = new Set<string>();
        for (const item of items) {
            const def = ticketGroupByKey(item.key);
            if (!def) throw new BadRequestException(`Ismeretlen csomag: ${item.key}`);
            if (seen.has(def.key)) throw new BadRequestException("Minden csomag csak egyszer szerepelhet.");
            seen.add(def.key);
            const ticketCount = Math.round(Number(item.ticketCount));
            const price = Math.round(Number(item.price));
            if (!Number.isFinite(ticketCount) || ticketCount < 1) {
                throw new BadRequestException("A jegyszám legalább 1 legyen.");
            }
            if (!Number.isFinite(price) || price < 0) {
                throw new BadRequestException("Az ár nem lehet negatív.");
            }
            const unitValue = Math.max(0, Math.round(price / ticketCount));
            const name = String(item.name || def.name).trim() || def.name;
            await this.prisma.$executeRaw`
                INSERT INTO "TicketPackGroup" ("key", name, "ticketCount", price, "unitValue", "sortOrder")
                VALUES (${def.key}, ${name}, ${ticketCount}, ${price}, ${unitValue}, ${TICKET_GROUPS.findIndex((g) => g.key === def.key)})
                ON CONFLICT ("key") DO UPDATE SET
                    name = ${name},
                    "ticketCount" = ${ticketCount},
                    price = ${price},
                    "unitValue" = ${unitValue}
            `;
        }
        return this.listCatalog();
    }

    private async resolveGroup(groupKey?: string) {
        const def = ticketGroupByKey(groupKey);
        if (!def) return null;
        const catalog = await this.listCatalog();
        return catalog.find((g) => g.key === def.key) || { ...def, unitLabel: `${def.unitValue} Ft/jegy` };
    }

    async balance(userId: string) {
        await this.ensureSchema();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT COALESCE(SUM("remainingCount"), 0)::int AS balance
            FROM "TicketPackPurchase"
            WHERE "userId" = ${userId} AND status = 'paid'
        `;
        const lots = await this.prisma.$queryRaw<any[]>`
            SELECT id, "groupKey", "groupName", "ticketCount", price, "unitValue",
                   "remainingCount", status, source, "paidAt", "createdAt"
            FROM "TicketPackPurchase"
            WHERE "userId" = ${userId}
            ORDER BY "createdAt" DESC
            LIMIT 40
        `;
        return {
            balance: rows[0]?.balance || 0,
            lots: lots.map((row) => ({
                ...row,
                unitLabel: `${row.unitValue} Ft/jegy`,
            })),
        };
    }

    async buy(userId: string, groupKey?: string) {
        const group = await this.resolveGroup(groupKey);
        if (!group) throw new BadRequestException("Ismeretlen jegycsomag.");
        await this.ensureSchema();
        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "TicketPackPurchase"
                (id, "userId", "groupKey", "groupName", "ticketCount", price, "unitValue",
                 "remainingCount", status, "createdAt")
            VALUES (
                ${id}, ${userId}, ${group.key}, ${group.name}, ${group.ticketCount},
                ${group.price}, ${group.unitValue}, 0, 'pending', NOW()
            )
        `;
        const pay = await this.payments.createForPack({
            id,
            userId,
            price: group.price,
            label: `${group.name} csomag (${group.ticketCount} jegy)`,
        });
        return {
            purchaseId: id,
            group,
            ...pay,
            message: pay.devPay
                ? "Tesztfizetés szükséges a csomag aktiválásához."
                : "A csomag fizetésre vár.",
        };
    }

    async activatePaid(purchaseId: string) {
        return this.payments.activatePack(purchaseId);
    }

    async assertCanAsk(userId: string) {
        const { balance } = await this.balance(userId);
        if (balance < 1) {
            throw new BadRequestException(
                "Nincs felhasználható jegyed. Vásárolj jegycsomagot.",
            );
        }
        return balance;
    }

    async spendOne(opts: {
        viewerUserId: string;
        streamerId: string;
        showId: string;
        questionId?: string;
    }) {
        await this.ensureSchema();
        const lots = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "TicketPackPurchase"
            WHERE "userId" = ${opts.viewerUserId}
              AND status = 'paid'
              AND "remainingCount" > 0
            ORDER BY "paidAt" ASC NULLS LAST, "createdAt" ASC
            LIMIT 1
        `;
        const lot = lots[0];
        if (!lot) return null;

        await this.prisma.$executeRaw`
            UPDATE "TicketPackPurchase"
            SET "remainingCount" = "remainingCount" - 1
            WHERE id = ${lot.id} AND "remainingCount" > 0
        `;

        const spendId = randomUUID();
        const amount = Number(lot.unitValue) * 1;
        await this.prisma.$executeRaw`
            INSERT INTO "TicketSpend"
                (id, "viewerUserId", "streamerId", "showId", "purchaseId", "ticketGroup",
                 "ticketsSpent", "ticketUnitValue", "calculatedAmount", "questionId", "createdAt")
            VALUES (
                ${spendId},
                ${opts.viewerUserId},
                ${opts.streamerId},
                ${opts.showId},
                ${lot.id},
                ${lot.groupName},
                1,
                ${lot.unitValue},
                ${amount},
                ${opts.questionId || null},
                NOW()
            )
        `;
        return {
            id: spendId,
            ticketGroup: lot.groupName,
            ticketsSpent: 1,
            ticketUnitValue: lot.unitValue,
            calculatedAmount: amount,
        };
    }

    async reportForStreamer(streamerId: string) {
        await this.ensureSchema();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT "ticketGroup" AS name,
                   SUM("ticketsSpent")::int AS tickets,
                   SUM("calculatedAmount")::int AS amount
            FROM "TicketSpend"
            WHERE "streamerId" = ${streamerId}
            GROUP BY "ticketGroup"
        `;
        const byName = new Map(rows.map((r) => [String(r.name), r]));
        const groups = emptyGroupStats().map((g) => {
            const hit = byName.get(g.name);
            return {
                ...g,
                ticketsSpent: hit?.tickets || 0,
                creditedAmount: hit?.amount || 0,
            };
        });
        for (const row of rows) {
            if (!groups.some((g) => g.name === row.name)) {
                groups.push({
                    key: String(row.name || "").toLowerCase(),
                    name: row.name,
                    ticketsSpent: row.tickets || 0,
                    creditedAmount: row.amount || 0,
                    unitValue: 0,
                });
            }
        }
        return {
            totalTicketsSpent: groups.reduce((s, g) => s + g.ticketsSpent, 0),
            totalCredited: groups.reduce((s, g) => s + g.creditedAmount, 0),
            groups,
        };
    }

    async reportAllStreamers() {
        await this.ensureSchema();
        const people = await this.prisma.streamer.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        });
        const reports = [];
        for (const s of people) {
            reports.push({
                streamerId: s.id,
                streamerName: s.name,
                email: s.email,
                ...(await this.reportForStreamer(s.id)),
            });
        }
        return reports;
    }

    private async ensureSchema() {
        const stmts = [
            `ALTER TABLE "Payment" ALTER COLUMN "ticketId" DROP NOT NULL`,
            `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "packPurchaseId" TEXT`,
            `CREATE TABLE IF NOT EXISTS "TicketPackPurchase" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "groupKey" TEXT NOT NULL,
                "groupName" TEXT NOT NULL,
                "ticketCount" INTEGER NOT NULL,
                "price" INTEGER NOT NULL,
                "unitValue" INTEGER NOT NULL,
                "remainingCount" INTEGER NOT NULL DEFAULT 0,
                "status" TEXT NOT NULL DEFAULT 'pending',
                "source" TEXT NOT NULL DEFAULT 'purchase',
                "paidAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS "TicketSpend" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "viewerUserId" TEXT NOT NULL,
                "streamerId" TEXT NOT NULL,
                "showId" TEXT,
                "purchaseId" TEXT,
                "ticketGroup" TEXT NOT NULL,
                "ticketsSpent" INTEGER NOT NULL,
                "ticketUnitValue" INTEGER NOT NULL,
                "calculatedAmount" INTEGER NOT NULL,
                "questionId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS "TicketPackGroup" (
                "key" TEXT NOT NULL PRIMARY KEY,
                "name" TEXT NOT NULL,
                "ticketCount" INTEGER NOT NULL,
                "price" INTEGER NOT NULL,
                "unitValue" INTEGER NOT NULL,
                "sortOrder" INTEGER NOT NULL DEFAULT 0
            )`,
            `CREATE INDEX IF NOT EXISTS "TicketPackPurchase_userId_idx" ON "TicketPackPurchase"("userId", "status", "createdAt")`,
            `ALTER TABLE "TicketPackPurchase" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'purchase'`,
            `CREATE INDEX IF NOT EXISTS "TicketSpend_streamerId_idx" ON "TicketSpend"("streamerId", "createdAt")`,
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
        const count = await this.prisma.$queryRaw<{ n: number }[]>`
            SELECT COUNT(*)::int AS n FROM "TicketPackGroup"
        `.catch(() => [{ n: 0 }]);
        if (!count[0]?.n) {
            for (let i = 0; i < TICKET_GROUPS.length; i += 1) {
                const g = TICKET_GROUPS[i];
                await this.prisma.$executeRaw`
                    INSERT INTO "TicketPackGroup" ("key", name, "ticketCount", price, "unitValue", "sortOrder")
                    VALUES (${g.key}, ${g.name}, ${g.ticketCount}, ${g.price}, ${g.unitValue}, ${i})
                    ON CONFLICT ("key") DO NOTHING
                `;
            }
        }
    }
}

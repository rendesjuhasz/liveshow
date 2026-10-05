import { randomUUID } from "crypto";
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { MailService } from "../mail/mail.service";
import {
    emptyGroupStats,
    giftSpendAmount,
    isGiftPack,
    MAX_GIFT_SPENDS_PER_SHOW,
    ticketGroupByKey,
    TICKET_GROUPS,
} from "./ticket-groups";

const MAX_GIFT_UNITS = 10_000;
export const QUESTION_HOLD_REASON = "question_hold";

type TicketDb = {
    $executeRaw: PrismaService["$executeRaw"];
    $queryRaw: PrismaService["$queryRaw"];
};

@Injectable()
export class TicketGroupsService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly payments: PaymentsService,
        private readonly mail: MailService,
    ) {}

    async onModuleInit() {
        await this.ensureSchema();
    }

    async listCatalog() {
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

    async giftSpendsForShow(userId: string, showId: string) {
        const id = String(showId || "").trim();
        if (!id) return 0;
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT COALESCE(SUM("ticketsSpent"), 0)::int AS n
            FROM "TicketSpend"
            WHERE "viewerUserId" = ${userId}
              AND "showId" = ${id}
              AND COALESCE("isGift", false) = true
              AND COALESCE(reason, '') NOT IN ('refunded', 'question_hold')
        `.catch(() => [{ n: 0 }]);
        return Number(rows[0]?.n) || 0;
    }

    async balance(userId: string, showId?: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT
                COALESCE(SUM("remainingCount"), 0)::int AS balance,
                COALESCE(
                    SUM(
                        CASE
                            WHEN COALESCE(source, 'purchase') <> 'purchase' OR "groupKey" = 'gift'
                                 OR COALESCE("unitValue", 0) <= 0
                            THEN "remainingCount"
                            ELSE 0
                        END
                    ),
                    0
                )::int AS "giftBalance"
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
        const balance = Number(rows[0]?.balance) || 0;
        const giftBalance = Number(rows[0]?.giftBalance) || 0;
        const purchasedBalance = Math.max(0, balance - giftBalance);
        const show = String(showId || "").trim();
        const giftSpendsThisShow = show ? await this.giftSpendsForShow(userId, show) : 0;
        const giftSpendsRemaining = show
            ? Math.max(0, MAX_GIFT_SPENDS_PER_SHOW - giftSpendsThisShow)
            : MAX_GIFT_SPENDS_PER_SHOW;
        return {
            balance,
            giftBalance,
            purchasedBalance,
            giftSpendsThisShow,
            giftSpendsRemaining,
            maxGiftSpendsPerShow: MAX_GIFT_SPENDS_PER_SHOW,
            usableOnShow: show
                ? purchasedBalance + Math.min(giftBalance, giftSpendsRemaining)
                : balance,
            lots: lots.map((row) => ({
                ...row,
                unitLabel: `${row.unitValue} Ft/jegy`,
            })),
        };
    }

    async grantGiftUnits(opts: {
        userId: string;
        ticketCount?: number;
        source?: string;
        groupName?: string;
        tx?: { $executeRaw: PrismaService["$executeRaw"]; $queryRaw: PrismaService["$queryRaw"] };
        skipMail?: boolean;
    }) {
        const userId = String(opts.userId || "").trim();
        if (!userId) throw new BadRequestException("A felhasználó azonosítója kötelező.");
        const ticketCount = Math.round(Number(opts.ticketCount ?? 1));
        if (!Number.isFinite(ticketCount) || ticketCount < 1 || ticketCount > MAX_GIFT_UNITS) {
            throw new BadRequestException(`A jegyszám 1 és ${MAX_GIFT_UNITS} között legyen.`);
        }
        const source = String(opts.source || "gift").trim() || "gift";
        const groupName = String(opts.groupName || "Ajándék kérdésjegy").trim() || "Ajándék kérdésjegy";
        const db = opts.tx || this.prisma;
        const purchaseId = randomUUID();
        await db.$executeRaw`
            INSERT INTO "TicketPackPurchase"
                (id, "userId", "groupKey", "groupName", "ticketCount", price, "unitValue",
                 "remainingCount", status, source, "paidAt", "createdAt")
            VALUES (
                ${purchaseId},
                ${userId},
                'gift',
                ${groupName},
                ${ticketCount},
                0,
                0,
                ${ticketCount},
                'paid',
                ${source},
                NOW(),
                NOW()
            )
        `;
        let balance = ticketCount;
        if (!opts.tx) {
            const current = await this.balance(userId);
            balance = current.balance;
        }
        if (!opts.skipMail) {
            void this.mail.packPurchased(userId, groupName, ticketCount, purchaseId);
        }
        return {
            purchaseId,
            ticketCount,
            remainingCount: ticketCount,
            balance,
            source,
            groupKey: "gift",
            groupName,
        };
    }

    async buy(userId: string, groupKey?: string) {
        const group = await this.resolveGroup(groupKey);
        if (!group) throw new BadRequestException("Ismeretlen jegycsomag.");
        const existingPending = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "TicketPackPurchase"
            WHERE "userId" = ${userId} AND "groupKey" = ${group.key} AND status = 'pending'
            ORDER BY "createdAt" DESC
            LIMIT 1
        `;
        const id = existingPending[0]?.id || randomUUID();
        if (!existingPending[0]?.id) {
            await this.prisma.$executeRaw`
            INSERT INTO "TicketPackPurchase"
                (id, "userId", "groupKey", "groupName", "ticketCount", price, "unitValue",
                 "remainingCount", status, "createdAt")
            VALUES (
                ${id}, ${userId}, ${group.key}, ${group.name}, ${group.ticketCount},
                ${group.price}, ${group.unitValue}, 0, 'pending', NOW()
            )
        `;
        }
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

    async assertCanAsk(userId: string, showId?: string) {
        const wallet = await this.balance(userId, showId);
        if (wallet.balance < 1) {
            throw new BadRequestException(
                "Nincs felhasználható jegyed. Vásárolj jegycsomagot.",
            );
        }
        if (showId && wallet.usableOnShow < 1) {
            throw new BadRequestException(
                `Ezen a műsoron maximum ${MAX_GIFT_SPENDS_PER_SHOW} ajándékjegyet használhatsz. Vásárolj jegycsomagot.`,
            );
        }
        return wallet.usableOnShow ?? wallet.balance;
    }

    async spendOne(
        opts: {
            viewerUserId: string;
            streamerId: string;
            showId: string;
            questionId?: string;
            reason?: string;
        },
        tx?: TicketDb,
    ) {
        if (tx) return this.spendOneOn(tx, opts);
        return this.prisma.$transaction((db) => this.spendOneOn(db, opts));
    }

    async releaseQuestionHold(
        opts: { questionId?: string; questionIds?: string[]; viewerUserId?: string },
        tx?: TicketDb,
    ) {
        if (tx) return this.releaseQuestionHoldOn(tx, opts);
        return this.prisma.$transaction((db) => this.releaseQuestionHoldOn(db, opts));
    }

    async captureQuestionTicket(
        opts: {
            viewerUserId: string;
            streamerId: string;
            showId: string;
            questionIds: string[];
        },
        tx: TicketDb,
    ) {
        const ids = opts.questionIds.map((id) => String(id || "").trim()).filter(Boolean);
        if (!ids.length) return null;
        const holds = await tx.$queryRaw<any[]>`
            SELECT * FROM "TicketSpend"
            WHERE "viewerUserId" = ${opts.viewerUserId}
              AND "showId" = ${opts.showId}
              AND reason = ${QUESTION_HOLD_REASON}
              AND "questionId" IN (${Prisma.join(ids)})
            ORDER BY "createdAt" ASC
            FOR UPDATE
        `;
        const keep = holds[0];
        if (keep) {
            await tx.$executeRaw`
                UPDATE "TicketSpend" SET reason = 'question' WHERE id = ${keep.id}
            `;
            const extra = holds.slice(1).map((row) => String(row.questionId || "")).filter(Boolean);
            if (extra.length) {
                await this.releaseQuestionHoldOn(tx, { questionIds: extra, viewerUserId: opts.viewerUserId });
            }
            return keep;
        }
        return this.spendOneOn(tx, {
            viewerUserId: opts.viewerUserId,
            streamerId: opts.streamerId,
            showId: opts.showId,
            questionId: ids[0],
            reason: "question",
        });
    }

    private async spendOneOn(
        tx: TicketDb,
        opts: {
            viewerUserId: string;
            streamerId: string;
            showId: string;
            questionId?: string;
            reason?: string;
        },
    ) {
        const reason = String(opts.reason || "question").trim().slice(0, 40) || "question";
        const usedRows = await tx.$queryRaw<any[]>`
            SELECT COALESCE(SUM("ticketsSpent"), 0)::int AS n
            FROM "TicketSpend"
            WHERE "viewerUserId" = ${opts.viewerUserId}
              AND "showId" = ${opts.showId}
              AND COALESCE("isGift", false) = true
              AND COALESCE(reason, '') NOT IN ('refunded', 'question_hold')
        `;
        const giftUsed = Number(usedRows[0]?.n) || 0;
        const allowGift = giftUsed < MAX_GIFT_SPENDS_PER_SHOW;

        let lot: any = null;
        if (allowGift) {
            const gifts = await tx.$queryRaw<any[]>`
                SELECT * FROM "TicketPackPurchase"
                WHERE "userId" = ${opts.viewerUserId}
                  AND status = 'paid'
                  AND "remainingCount" > 0
                  AND (
                    COALESCE(source, 'purchase') <> 'purchase'
                    OR "groupKey" = 'gift'
                    OR COALESCE("unitValue", 0) <= 0
                  )
                ORDER BY "paidAt" ASC NULLS LAST, "createdAt" ASC
                LIMIT 1
                FOR UPDATE
            `;
            lot = gifts[0] || null;
        }
        if (!lot) {
            const paid = await tx.$queryRaw<any[]>`
                SELECT * FROM "TicketPackPurchase"
                WHERE "userId" = ${opts.viewerUserId}
                  AND status = 'paid'
                  AND "remainingCount" > 0
                  AND COALESCE(source, 'purchase') = 'purchase'
                  AND "groupKey" <> 'gift'
                  AND COALESCE("unitValue", 0) > 0
                ORDER BY "paidAt" ASC NULLS LAST, "createdAt" ASC
                LIMIT 1
                FOR UPDATE
            `;
            lot = paid[0] || null;
        }
        if (!lot) return null;

        const updated = await tx.$executeRaw`
            UPDATE "TicketPackPurchase"
            SET "remainingCount" = "remainingCount" - 1
            WHERE id = ${lot.id} AND "remainingCount" > 0
        `;
        if (!updated) return null;

        const gift = isGiftPack(lot);
        const amount = giftSpendAmount(lot.unitValue, gift);
        const spendId = randomUUID();
        await tx.$executeRaw`
            INSERT INTO "TicketSpend"
                (id, "viewerUserId", "streamerId", "showId", "purchaseId", "ticketGroup",
                 "ticketsSpent", "ticketUnitValue", "calculatedAmount", "questionId",
                 source, "groupKey", "isGift", reason, "createdAt")
            VALUES (
                ${spendId},
                ${opts.viewerUserId},
                ${opts.streamerId},
                ${opts.showId},
                ${lot.id},
                ${lot.groupName},
                1,
                ${gift ? 0 : lot.unitValue},
                ${amount},
                ${opts.questionId || null},
                ${String(lot.source || (gift ? "gift" : "purchase"))},
                ${String(lot.groupKey || "")},
                ${gift},
                ${reason},
                NOW()
            )
        `;
        return {
            id: spendId,
            ticketGroup: lot.groupName,
            ticketsSpent: 1,
            ticketUnitValue: gift ? 0 : Number(lot.unitValue) || 0,
            calculatedAmount: amount,
            isGift: gift,
            source: String(lot.source || (gift ? "gift" : "purchase")),
            reason,
        };
    }

    private async releaseQuestionHoldOn(
        tx: TicketDb,
        opts: { questionId?: string; questionIds?: string[]; viewerUserId?: string },
    ) {
        const ids = [
            ...new Set(
                [opts.questionId, ...(opts.questionIds || [])]
                    .map((id) => String(id || "").trim())
                    .filter(Boolean),
            ),
        ];
        if (!ids.length) return 0;
        const viewer = String(opts.viewerUserId || "").trim();
        const holds = viewer
            ? await tx.$queryRaw<any[]>`
                SELECT * FROM "TicketSpend"
                WHERE reason = ${QUESTION_HOLD_REASON}
                  AND "questionId" IN (${Prisma.join(ids)})
                  AND "viewerUserId" = ${viewer}
                FOR UPDATE
              `
            : await tx.$queryRaw<any[]>`
                SELECT * FROM "TicketSpend"
                WHERE reason = ${QUESTION_HOLD_REASON}
                  AND "questionId" IN (${Prisma.join(ids)})
                FOR UPDATE
              `;
        for (const row of holds) {
            if (row.purchaseId) {
                await tx.$executeRaw`
                    UPDATE "TicketPackPurchase"
                    SET "remainingCount" = "remainingCount" + ${Number(row.ticketsSpent) || 1}
                    WHERE id = ${row.purchaseId}
                `;
            }
            await tx.$executeRaw`DELETE FROM "TicketSpend" WHERE id = ${row.id}`;
        }
        return holds.length;
    }

    async reportForStreamer(streamerId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT "ticketGroup" AS name,
                   SUM("ticketsSpent")::int AS tickets,
                   SUM(CASE WHEN COALESCE("isGift", false) THEN 0 ELSE "calculatedAmount" END)::int AS amount,
                   SUM(CASE WHEN COALESCE("isGift", false) THEN "ticketsSpent" ELSE 0 END)::int AS "giftTickets"
            FROM "TicketSpend"
            WHERE "streamerId" = ${streamerId}
              AND COALESCE(reason, '') NOT IN ('refunded', 'question_hold')
            GROUP BY "ticketGroup"
        `;
        const totals = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COALESCE(SUM("ticketsSpent"), 0)::int AS tickets,
                       COALESCE(SUM(CASE WHEN COALESCE("isGift", false) THEN 0 ELSE "calculatedAmount" END), 0)::int AS amount,
                       COALESCE(SUM(CASE WHEN COALESCE("isGift", false) THEN "ticketsSpent" ELSE 0 END), 0)::int AS "giftTickets"
                FROM "TicketSpend"
                WHERE "streamerId" = ${streamerId}
                  AND COALESCE(reason, '') NOT IN ('refunded', 'question_hold')
            `
        )[0] || { tickets: 0, amount: 0, giftTickets: 0 };
        const byName = new Map(rows.map((r) => [String(r.name), r]));
        const groups = emptyGroupStats().map((g) => {
            const hit = byName.get(g.name);
            return {
                ...g,
                ticketsSpent: hit?.tickets || 0,
                creditedAmount: hit?.amount || 0,
                giftTicketsSpent: hit?.giftTickets || 0,
            };
        });
        for (const row of rows) {
            if (!groups.some((g) => g.name === row.name)) {
                groups.push({
                    key: String(row.name || "").toLowerCase(),
                    name: row.name,
                    ticketsSpent: row.tickets || 0,
                    creditedAmount: row.amount || 0,
                    giftTicketsSpent: row.giftTickets || 0,
                    unitValue: 0,
                });
            }
        }
        return {
            totalTicketsSpent: Number(totals.tickets) || 0,
            paidTicketsSpent: Math.max(
                0,
                (Number(totals.tickets) || 0) - (Number(totals.giftTickets) || 0),
            ),
            giftTicketsSpent: Number(totals.giftTickets) || 0,
            totalCredited: Number(totals.amount) || 0,
            groups,
        };
    }

    async reportAllStreamers() {
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
                source TEXT,
                "groupKey" TEXT,
                "isGift" BOOLEAN NOT NULL DEFAULT false,
                reason TEXT,
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
            `ALTER TABLE "TicketSpend" ADD COLUMN IF NOT EXISTS source TEXT`,
            `ALTER TABLE "TicketSpend" ADD COLUMN IF NOT EXISTS "groupKey" TEXT`,
            `ALTER TABLE "TicketSpend" ADD COLUMN IF NOT EXISTS "isGift" BOOLEAN NOT NULL DEFAULT false`,
            `ALTER TABLE "TicketSpend" ADD COLUMN IF NOT EXISTS reason TEXT`,
            `CREATE INDEX IF NOT EXISTS "TicketSpend_viewer_show_gift_idx" ON "TicketSpend"("viewerUserId", "showId", "isGift")`,
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
        await this.prisma.$executeRawUnsafe(`
            UPDATE "TicketSpend" sp
            SET
                "isGift" = true,
                "calculatedAmount" = 0,
                "ticketUnitValue" = 0,
                source = COALESCE(sp.source, p.source, 'gift'),
                "groupKey" = COALESCE(sp."groupKey", p."groupKey")
            FROM "TicketPackPurchase" p
            WHERE sp."purchaseId" = p.id
              AND COALESCE(sp.source, '') = ''
              AND (
                COALESCE(p.source, 'purchase') <> 'purchase'
                OR p."groupKey" = 'gift'
                OR COALESCE(p."unitValue", 0) <= 0
              )
        `).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(`
            UPDATE "TicketSpend" sp
            SET source = COALESCE(sp.source, p.source, 'purchase'),
                "groupKey" = COALESCE(sp."groupKey", p."groupKey")
            FROM "TicketPackPurchase" p
            WHERE sp."purchaseId" = p.id
              AND COALESCE(sp.source, '') = ''
        `).catch(() => undefined);
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

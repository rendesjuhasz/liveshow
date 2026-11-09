import { randomUUID } from "crypto";
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { isPayoutStatus } from "./commission";
import { canReservePayout, computeStreamerRevenue } from "./revenue";
import { ensurePayoutSchema, getPayoutSettings, setPayoutSettings } from "./platform-config";
import { payoutReceiptHtml, type PayoutSnapshot } from "./payout-receipt";
import { USER_ROLES } from "../auth/roles";
import { advisoryXactLock } from "../db/advisory-lock";

@Injectable()
export class PayoutsService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
    ) {}

    async onModuleInit() {
        await ensurePayoutSchema(this.prisma);
    }

    settings() {
        return getPayoutSettings(this.prisma);
    }

    updateSettings(body: { commissionPercent?: number; streamerPercent?: number; payoutCycle?: string }) {
        return setPayoutSettings(this.prisma, body);
    }

    revenue(streamerId: string) {
        return computeStreamerRevenue(this.prisma, streamerId);
    }

    async requestPayout(opts: {
        streamerId: string;
        amount?: number;
        actorUserId?: string;
        requestedBy?: "streamer" | "admin";
    }) {
        const streamer = await this.prisma.streamer.findUnique({ where: { id: opts.streamerId } });
        if (!streamer) throw new NotFoundException("A tartalomkészítő nem található.");
        const legal = await this.legalForStreamer(opts.streamerId);
        const id = randomUUID();

        await this.prisma.$transaction(async (tx) => {
            await advisoryXactLock(tx, `payout:${opts.streamerId}`);
            const money = await computeStreamerRevenue(tx as PrismaService, opts.streamerId);
            const value = Math.round(Number(opts.amount ?? money.available));
            if (!canReservePayout(money.available, value)) {
                if (!Number.isFinite(value) || value <= 0) {
                    throw new BadRequestException("Pozitív összeg kell.");
                }
                throw new BadRequestException(
                    `Maximum ${money.available} Ft kérhető ki a nettó egyenlegből.`,
                );
            }
            const snapshot: PayoutSnapshot = {
                streamerName: streamer.name,
                amount: value,
                gross: money.gross,
                commission: money.commission,
                net: money.net,
                platformPercent: money.commissionPercent,
                streamerPercent: money.streamerPercent,
                tickets: money.ticketsSold,
                createdAt: new Date().toISOString(),
                shows: money.shows.map((s) => ({
                    title: s.title,
                    tickets: s.tickets,
                    gross: s.gross,
                    commission: s.commission,
                    net: s.net,
                    platformPercent: s.platformPercent,
                })),
            };
            await tx.$executeRaw`
                INSERT INTO "Payout"
                    (id, "streamerId", amount, status, "createdAt", "requestedBy", snapshot, method)
                VALUES (
                    ${id},
                    ${opts.streamerId},
                    ${value},
                    'pending',
                    NOW(),
                    ${opts.requestedBy || "streamer"},
                    ${JSON.stringify(snapshot)},
                    ${legal.preferredPayoutMethod || "bank_transfer"}
                )
            `;
        });

        await this.logEvent(id, opts.actorUserId, "requested", null, "pending");
        await this.notifyAdmins(id);
        const row = await this.getPayout(id);
        void this.mail.payoutRequested(row);
        return row;
    }

    async listAdmin() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT p.*, s.name AS "streamerName", s.email AS "streamerEmail"
            FROM "Payout" p
            JOIN "Streamer" s ON s.id = p."streamerId"
            ORDER BY p."createdAt" DESC
            LIMIT 300
        `;
        return rows.map((row) => this.mapPayout(row));
    }

    listForStreamer(streamerId: string) {
        return this.prisma.payout.findMany({
            where: { streamerId },
            orderBy: { createdAt: "desc" },
        });
    }

    async setStatus(id: string, status?: string, extra?: { method?: string; actorUserId?: string }) {
        const next = String(status || "").trim().toLowerCase();
        if (!isPayoutStatus(next)) {
            throw new BadRequestException("Érvénytelen státusz. pending, approved, paid vagy rejected.");
        }
        const row = await this.getPayout(id);
        if (next === "approved" && row.status !== "pending") {
            throw new BadRequestException("Csak függőben lévő kérést lehet jóváhagyni.");
        }
        if (next === "rejected" && row.status !== "pending") {
            throw new BadRequestException("Csak függőben lévő kérést lehet elutasítani.");
        }
        if (next === "paid" && row.status !== "approved") {
            throw new BadRequestException("Csak folyamatban lévő kifizetést lehet kifizetettnek jelölni.");
        }
        if (next === "pending") {
            throw new BadRequestException("A státusz nem állítható vissza függőre.");
        }
        const method = extra?.method?.trim() || row.method || "bank_transfer";
        await this.prisma.payout.update({
            where: { id },
            data: { status: next },
        });
        if (next === "approved" || next === "rejected") {
            await this.prisma.$executeRaw`
                UPDATE "Payout" SET method = ${method}, "reviewedAt" = NOW() WHERE id = ${id}
            `;
        }
        if (next === "paid") {
            await this.prisma.$executeRaw`
                UPDATE "Payout" SET method = ${method}, "paidAt" = NOW() WHERE id = ${id}
            `;
        }
        await this.logEvent(id, extra?.actorUserId, next, row.status, next);
        const updated = await this.getPayout(id);
        if (next === "approved") void this.mail.payoutApproved(id);
        if (next === "paid") void this.mail.payoutPaid(id);
        return updated;
    }

    async receiptHtml(payoutId: string, streamerId?: string) {
        const row = await this.getPayout(payoutId);
        if (streamerId && row.streamerId !== streamerId) {
            throw new ForbiddenException("Csak a saját bizonylatod tölthető le.");
        }
        const snapshot = this.parseSnapshot(row.snapshot) || {
            streamerName: row.streamerName,
            amount: row.amount,
            gross: row.amount,
            commission: 0,
            net: row.amount,
            platformPercent: 0,
            streamerPercent: 100,
            tickets: 0,
            method: row.method,
            paidAt: row.paidAt,
            createdAt: row.createdAt,
            shows: [],
        };
        snapshot.method = row.method || snapshot.method;
        snapshot.paidAt = row.paidAt || snapshot.paidAt;
        snapshot.createdAt = row.createdAt || snapshot.createdAt;
        snapshot.streamerName = snapshot.streamerName || row.streamerName;
        snapshot.amount = row.amount;
        return payoutReceiptHtml(snapshot);
    }

    async leaderboard(limit = 20) {
        const settings = await getPayoutSettings(this.prisma);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT st.id, COALESCE(NULLIF(u.username, ''), 'Tartalomkészítő') AS name, st."avatarUrl", st.status,
                   COALESCE(SUM(CASE WHEN COALESCE(sp."isGift", false) THEN 0 ELSE sp."ticketsSpent" END), 0)::int AS tickets,
                   COALESCE(SUM(CASE WHEN COALESCE(sp."isGift", false) THEN 0 ELSE sp."calculatedAmount" END), 0)::int AS gross
            FROM "Streamer" st
            LEFT JOIN "User" u ON u.id = st."userId"
            LEFT JOIN "TicketSpend" sp ON sp."streamerId" = st.id
              AND COALESCE(sp.reason, '') NOT IN ('refunded', 'question_hold')
            WHERE st.status = 'approved'
            GROUP BY st.id, u.username, st."avatarUrl", st.status
            ORDER BY gross DESC, tickets DESC
            LIMIT 20
        `.catch(() => []);
        return rows.map((row, index) => {
            const split = {
                gross: Number(row.gross) || 0,
                net: Math.round(((Number(row.gross) || 0) * settings.streamerPercent) / 100),
            };
            return {
                rank: index + 1,
                id: row.id,
                name: row.name,
                avatarUrl: row.avatarUrl,
                tickets: row.tickets || 0,
                gross: split.gross,
                net: split.net,
            };
        });
    }

    async publicLeaderboard() {
        const rows = await this.leaderboard();
        return rows.map((row) => ({
            rank: row.rank,
            id: row.id,
            name: row.name,
            avatarUrl: row.avatarUrl,
        }));
    }

    async legalForStreamer(streamerId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT "invoiceCapable", "taxDeclarationAcceptedAt", "contractShareAcceptedAt",
                   "preferredPayoutMethod"
            FROM "Streamer" WHERE id = ${streamerId} LIMIT 1
        `;
        const row = rows[0] || {};
        return {
            invoiceCapable: Boolean(row.invoiceCapable),
            taxDeclarationAcceptedAt: row.taxDeclarationAcceptedAt || null,
            contractShareAcceptedAt: row.contractShareAcceptedAt || null,
            preferredPayoutMethod: row.preferredPayoutMethod || "bank_transfer",
        };
    }

    async updateLegal(
        streamerId: string,
        body: {
            invoiceCapable?: boolean;
            taxDeclarationAccepted?: boolean;
            contractShareAccepted?: boolean;
            preferredPayoutMethod?: string;
        },
    ) {
        const current = await this.legalForStreamer(streamerId);
        const invoice = body.invoiceCapable === undefined ? current.invoiceCapable : Boolean(body.invoiceCapable);
        const method = String(body.preferredPayoutMethod || current.preferredPayoutMethod || "bank_transfer").slice(0, 40);
        const tax = body.taxDeclarationAccepted
            ? new Date()
            : current.taxDeclarationAcceptedAt;
        const contract = body.contractShareAccepted
            ? new Date()
            : current.contractShareAcceptedAt;
        await this.prisma.$executeRaw`
            UPDATE "Streamer"
            SET "invoiceCapable" = ${invoice},
                "preferredPayoutMethod" = ${method},
                "taxDeclarationAcceptedAt" = ${tax},
                "contractShareAcceptedAt" = ${contract}
            WHERE id = ${streamerId}
        `;
        return this.legalForStreamer(streamerId);
    }

    private async getPayout(id: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT p.*, s.name AS "streamerName", s.email AS "streamerEmail"
            FROM "Payout" p
            JOIN "Streamer" s ON s.id = p."streamerId"
            WHERE p.id = ${id}
            LIMIT 1
        `;
        if (!rows[0]) throw new NotFoundException("A kifizetés nem található.");
        return this.mapPayout(rows[0]);
    }

    private mapPayout(row: any) {
        return {
            id: row.id,
            streamerId: row.streamerId,
            amount: row.amount,
            status: row.status,
            createdAt: row.createdAt,
            reviewedAt: row.reviewedAt || null,
            paidAt: row.paidAt || null,
            method: row.method || null,
            requestedBy: row.requestedBy || "streamer",
            snapshot: this.parseSnapshot(row.snapshot),
            streamer: {
                id: row.streamerId,
                name: row.streamerName,
                email: row.streamerEmail,
            },
            streamerName: row.streamerName,
        };
    }

    private parseSnapshot(raw: unknown): PayoutSnapshot | null {
        if (!raw) return null;
        if (typeof raw === "object") return raw as PayoutSnapshot;
        try {
            return JSON.parse(String(raw));
        } catch {
            return null;
        }
    }

    private async logEvent(
        payoutId: string,
        actorUserId: string | undefined,
        action: string,
        fromStatus: string | null,
        toStatus: string | null,
    ) {
        await this.prisma.$executeRaw`
            INSERT INTO "PayoutEvent" (id, "payoutId", "actorUserId", action, "fromStatus", "toStatus", "createdAt")
            VALUES (${randomUUID()}, ${payoutId}, ${actorUserId || null}, ${action}, ${fromStatus}, ${toStatus}, NOW())
        `.catch(() => undefined);
    }

    private async notifyAdmins(payoutId: string) {
        const admins = await this.prisma.user.findMany({
            where: { role: USER_ROLES.ADMIN },
            select: { id: true },
        }).catch(() => []);
        const ids = new Set(admins.map((a) => a.id));
        for (const userId of ids) {
            await this.prisma.$executeRaw`
                INSERT INTO "UserNotification" (id, "userId", type, title, body, read, "relatedId", "createdAt")
                VALUES (
                    ${randomUUID()},
                    ${userId},
                    'payout',
                    'Kifizetési igény',
                    'Új tartalomkészítő kifizetési igény érkezett.',
                    false,
                    ${payoutId},
                    NOW()
                )
            `.catch(() => undefined);
        }
    }
}

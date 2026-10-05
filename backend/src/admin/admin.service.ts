import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ArchiveService } from "../archive/archive.service";
import { ShowsService } from "../shows/shows.service";
import { TicketsService } from "../tickets/tickets.service";
import { TicketGroupsService } from "../tickets/ticket-groups.service";
import { GiftCampaignsService } from "../tickets/gift-campaigns.service";
import { PrismaService } from "../prisma/prisma.service";
import { USER_ROLES } from "../auth/roles";
import { isShowStatus } from "../shows/show-status";
import { setShowStatus as writeShowStatus } from "../shows/show-status-db";
import { splitRevenue } from "../payouts/commission";
import { getCommissionPercent, getPayoutSettings, setPayoutSettings } from "../payouts/platform-config";
import { ViewLogService } from "../stats/view-log.service";
import { TICKET_GROUPS } from "../tickets/ticket-groups";
import { ReferralService } from "../referrals/referral.service";

type ShowInput = {
    title?: string;
    description?: string;
    image?: string;
    date?: string;
    startTime?: string;
    price?: number | string;
    live?: boolean;
    featured?: boolean;
    streamUrl?: string;
    streamId?: string;
    streamerId?: string;
    videoCategory?: string;
    status?: string;
    commissionPercent?: number | null;
};

@Injectable()
export class AdminService {
    constructor(
        private showsService: ShowsService,
        private archiveService: ArchiveService,
        private ticketsService: TicketsService,
        private ticketGroups: TicketGroupsService,
        private campaigns: GiftCampaignsService,
        private prisma: PrismaService,
        private views: ViewLogService,
        private referrals: ReferralService,
    ) {}

    createShow(data: ShowInput) {
        this.assertShowInput(data);

        return this.showsService.createShow({
            title: data.title!.trim(),
            description: data.description,
            image: data.image,
            startTime: data.startTime || data.date,
            price: 0,
            live: data.live,
            featured: data.featured,
            streamUrl: data.streamUrl,
            streamId: data.streamId,
            streamerId: data.streamerId,
            videoCategory: data.videoCategory,
            status: data.status || "draft",
        });
    }

    async getShowArchive(id: string) {
        return this.archiveService.getArchive(id, { allowHidden: true });
    }

    async regenerateShowArchive(id: string) {
        await this.archiveService.deleteArchive(id);
        return this.archiveService.generateArchive(id);
    }

    async deleteShowArchive(id: string) {
        return this.archiveService.deleteArchive(id);
    }

    async deleteShow(id: string) {
        await this.showsService.getShowById(id, { allowHidden: true });
        return this.showsService.deleteShow(id);
    }

    listShows() {
        return this.showsService.listAllForAdmin();
    }

    async getShow(id: string) {
        const show = await this.showsService.getShowById(id, { allowHidden: true });
        const extra = await this.prisma.$queryRaw<any[]>`
            SELECT "commissionPercent" FROM "Show" WHERE id = ${id} LIMIT 1
        `.catch(() => []);
        return {
            ...show,
            commissionPercent: extra[0]?.commissionPercent ?? null,
        };
    }

    async setShowStatus(id: string, status?: string) {
        await this.showsService.getShowById(id, { allowHidden: true });
        const next = String(status || "").trim().toLowerCase();
        if (!isShowStatus(next)) {
            throw new BadRequestException(
                "Érvénytelen státusz. draft, pending, active, blocked, archived vagy missed.",
            );
        }
        await writeShowStatus(this.prisma, id, next);
        return this.showsService.getShowById(id, { allowHidden: true });
    }

    async updateShow(id: string, data: ShowInput) {
        await this.showsService.getShowById(id, { allowHidden: true });
        this.assertShowInput(data);

        await this.showsService.updateShow(id, {
            title: data.title!.trim(),
            description: data.description,
            image: data.image,
            startTime: data.startTime || data.date,
            price: 0,
            live: data.live,
            featured: data.featured,
            streamUrl: data.streamUrl,
            streamId: data.streamId,
            streamerId: data.streamerId,
            videoCategory: data.videoCategory,
            status: data.status,
        });
        if (data.commissionPercent !== undefined) {
            const raw = data.commissionPercent;
            if (raw === null || raw === ("" as any) || Number(raw) < 0) {
                await this.prisma.$executeRaw`UPDATE "Show" SET "commissionPercent" = NULL WHERE id = ${id}`;
            } else {
                const value = Math.min(90, Math.max(0, Math.round(Number(raw))));
                await this.prisma.$executeRaw`UPDATE "Show" SET "commissionPercent" = ${value} WHERE id = ${id}`;
            }
        }
        return this.getShow(id);
    }

    getCommission() {
        return getPayoutSettings(this.prisma);
    }

    async setCommission(body: { percent?: number; commissionPercent?: number; streamerPercent?: number; payoutCycle?: string }) {
        return setPayoutSettings(this.prisma, {
            commissionPercent: body.percent ?? body.commissionPercent,
            streamerPercent: body.streamerPercent,
            payoutCycle: body.payoutCycle,
        });
    }

    listTickets() {
        return this.ticketsService.listAll();
    }

    async giftTicket(email?: string, ticketCount?: number) {
        const normalized = String(email || "").trim().toLowerCase();
        if (!normalized) throw new BadRequestException("Email kötelező.");
        const user = await this.prisma.user.findUnique({ where: { email: normalized } });
        if (!user) throw new NotFoundException("Nincs ilyen felhasználó.");
        const granted = await this.ticketGroups.grantGiftUnits({
            userId: user.id,
            ticketCount,
            source: "gift",
        });
        await this.campaigns.logAdminGift(user.id, null, null, granted.purchaseId);
        return {
            message: `${granted.ticketCount} kérdésjegy jóváírva.`,
            email: user.email,
            ...granted,
        };
    }

    resendTicketEmail(adminUserId: string, ticketId: string) {
        return this.ticketsService.resendPurchaseEmail(adminUserId, ticketId, true);
    }

    listCampaigns() {
        return this.campaigns.list();
    }

    getCampaign(id: string) {
        return this.campaigns.getById(id);
    }

    createCampaign(body: any) {
        return this.campaigns.create(body);
    }

    updateCampaign(id: string, body: any) {
        return this.campaigns.update(id, body);
    }

    async stats() {
        const [users, shows, streamers, archives, paymentsPaid] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.show.count(),
            this.prisma.streamer.count(),
            this.prisma.archive.count(),
            this.prisma.payment.aggregate({
                where: { status: "paid" },
                _sum: { amount: true },
            }),
        ]);

        const packTotals = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS purchases,
                       COALESCE(SUM("ticketCount"), 0)::int AS tickets,
                       COALESCE(SUM(price), 0)::int AS revenue
                FROM "TicketPackPurchase"
                WHERE status = 'paid'
                  AND COALESCE(price, 0) > 0
                  AND COALESCE(source, 'purchase') = 'purchase'
            `.catch(() => [{ purchases: 0, tickets: 0, revenue: 0 }])
        )[0] || { purchases: 0, tickets: 0, revenue: 0 };

        const packPending = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS purchases,
                       COALESCE(SUM("ticketCount"), 0)::int AS tickets
                FROM "TicketPackPurchase"
                WHERE status = 'pending'
            `.catch(() => [{ purchases: 0, tickets: 0 }])
        )[0] || { purchases: 0, tickets: 0 };

        const byGroupRaw = await this.prisma.$queryRaw<any[]>`
            SELECT "groupKey" AS key,
                   "groupName" AS name,
                   COUNT(*)::int AS purchases,
                   COALESCE(SUM("ticketCount"), 0)::int AS count,
                   COALESCE(SUM(price), 0)::int AS revenue
            FROM "TicketPackPurchase"
            WHERE status = 'paid'
              AND COALESCE(price, 0) > 0
              AND COALESCE(source, 'purchase') = 'purchase'
            GROUP BY "groupKey", "groupName"
            ORDER BY revenue DESC
        `.catch(() => []);

        const byGroupMap = new Map(byGroupRaw.map((r) => [String(r.key), r]));
        const byCategory = TICKET_GROUPS.map((g) => {
            const hit = byGroupMap.get(g.key);
            return {
                key: g.key,
                name: g.name,
                count: hit?.count || 0,
                purchases: hit?.purchases || 0,
                revenue: hit?.revenue || 0,
            };
        });

        const spendTotals = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COALESCE(SUM("ticketsSpent"), 0)::int AS tickets,
                       COALESCE(SUM(CASE WHEN COALESCE("isGift", false) THEN 0 ELSE "calculatedAmount" END), 0)::int AS amount
                FROM "TicketSpend"
                WHERE COALESCE(reason, '') NOT IN ('refunded', 'question_hold')
            `.catch(() => [{ tickets: 0, amount: 0 }])
        )[0] || { tickets: 0, amount: 0 };

        const commissionPercent = await getCommissionPercent(this.prisma);
        const saleSplit = splitRevenue(Number(packTotals.revenue) || 0, commissionPercent);
        const creditedSplit = splitRevenue(Number(spendTotals.amount) || 0, commissionPercent);

        const topShowsRaw = await this.prisma.$queryRaw<any[]>`
            SELECT s.id, s.title, st.name AS streamer,
                   COALESCE(SUM(CASE WHEN COALESCE(sp."isGift", false) THEN 0 ELSE sp."ticketsSpent" END), 0)::int AS tickets,
                   COALESCE(SUM(CASE WHEN COALESCE(sp."isGift", false) THEN 0 ELSE sp."calculatedAmount" END), 0)::int AS gross
            FROM "TicketSpend" sp
            JOIN "Show" s ON s.id = sp."showId"
            LEFT JOIN "Streamer" st ON st.id = s."streamerId"
            WHERE COALESCE(sp.reason, '') NOT IN ('refunded', 'question_hold')
            GROUP BY s.id, s.title, st.name
            ORDER BY tickets DESC, gross DESC
            LIMIT 10
        `.catch(() => []);

        const streamerPerfRaw = await this.prisma.$queryRaw<any[]>`
            SELECT st.id, st.name, st.status,
                   COALESCE(SUM(CASE WHEN COALESCE(sp."isGift", false) THEN 0 ELSE sp."ticketsSpent" END), 0)::int AS tickets,
                   COALESCE(SUM(CASE WHEN COALESCE(sp."isGift", false) THEN 0 ELSE sp."calculatedAmount" END), 0)::int AS gross,
                   COUNT(DISTINCT s.id)::int AS shows
            FROM "Streamer" st
            LEFT JOIN "TicketSpend" sp ON sp."streamerId" = st.id
              AND COALESCE(sp.reason, '') NOT IN ('refunded', 'question_hold')
            LEFT JOIN "Show" s ON s."streamerId" = st.id
            GROUP BY st.id, st.name, st.status
            ORDER BY gross DESC, tickets DESC
        `.catch(() => []);

        const liveMap = this.views.liveByShow();
        const liveShows = await this.prisma.show.findMany({
            where: { live: true },
            select: {
                id: true,
                title: true,
                streamId: true,
                streamerId: true,
                streamer: { select: { name: true } },
            },
        });
        const showIdRows = await this.prisma.show.findMany({
            select: { id: true, streamerId: true },
        });
        const allShowIds = showIdRows.map((s) => s.id);
        const [peakMap, avgMap, peakViewers, averageWatchSeconds, streamErrors] = await Promise.all([
            this.views.peaksByShowIds(allShowIds),
            this.views.averageWatchByShowIds(allShowIds),
            this.views.platformPeakViewers(),
            this.views.platformWatchAverage(),
            this.views.listStreamErrors(40),
        ]);
        const liveByShow = liveShows.map((show) => ({
            showId: show.id,
            title: show.title,
            streamer: show.streamer?.name || null,
            viewers: liveMap.get(show.id) || liveMap.get(show.streamId || "") || 0,
            peakViewers: peakMap.get(show.id) || 0,
            live: true,
        }));

        const archiveRows = await this.views.archiveViewsByShow();
        const archiveShowIds = archiveRows.map((r) => r.showId).filter(Boolean);
        const archiveShows = archiveShowIds.length
            ? await this.prisma.show.findMany({
                  where: { id: { in: archiveShowIds } },
                  select: { id: true, title: true, streamerId: true, streamer: { select: { name: true } } },
              })
            : [];
        const archiveByShow = archiveRows
            .map((row) => {
                const show = archiveShows.find((s) => s.id === row.showId);
                return {
                    showId: row.showId,
                    title: show?.title || row.showId,
                    streamerId: show?.streamerId || null,
                    streamer: show?.streamer?.name || null,
                    views: row.views || 0,
                };
            })
            .sort((a, b) => b.views - a.views);

        const topShows = topShowsRaw.map((row) => {
            const part = splitRevenue(row.gross, commissionPercent);
            return {
                id: row.id,
                title: row.title,
                streamer: row.streamer,
                tickets: row.tickets,
                gross: part.gross,
                commission: part.commission,
                net: part.net,
            };
        });

        const privateTotals = (
            await this.prisma.$queryRaw<any[]>`
                SELECT
                    COUNT(*) FILTER (WHERE t.status IN ('paid', 'active'))::int AS paid,
                    COUNT(*) FILTER (WHERE t.status = 'pending')::int AS pending,
                    COALESCE(SUM(t.price) FILTER (WHERE t.status IN ('paid', 'active')), 0)::int AS revenue
                FROM "PrivateRequest" r
                JOIN "Ticket" t ON t.id = r."ticketId"
            `.catch(() => [{ paid: 0, pending: 0, revenue: 0 }])
        )[0] || { paid: 0, pending: 0, revenue: 0 };

        const privatePurchases = await this.prisma.$queryRaw<any[]>`
            SELECT r.id AS "requestId",
                   r.topic,
                   r.status AS "requestStatus",
                   t.id AS "ticketId",
                   t.price,
                   t.status AS "ticketStatus",
                   t."createdAt",
                   s.title AS "showTitle",
                   st.name AS streamer,
                   u.email AS "viewerEmail"
            FROM "PrivateRequest" r
            LEFT JOIN "Ticket" t ON t.id = r."ticketId"
            LEFT JOIN "Show" s ON s.id = r."showId"
            LEFT JOIN "Streamer" st ON st.id = s."streamerId"
            LEFT JOIN "User" u ON u.id = r."userId"
            WHERE t.id IS NOT NULL
            ORDER BY t."createdAt" DESC
            LIMIT 40
        `.catch(() => []);

        const privateByStreamer = await this.prisma.$queryRaw<any[]>`
            SELECT s."streamerId" AS id,
                   COUNT(*)::int AS tickets,
                   COALESCE(SUM(t.price), 0)::int AS gross
            FROM "PrivateRequest" r
            JOIN "Ticket" t ON t.id = r."ticketId"
            JOIN "Show" s ON s.id = r."showId"
            WHERE t.status IN ('paid', 'active')
            GROUP BY s."streamerId"
        `.catch(() => []);
        const privateStreamerMap = new Map(
            privateByStreamer.map((row) => [String(row.id), row]),
        );

        const giftTickets = await this.referrals.giftTicketStats();
        const privateSplit = splitRevenue(Number(privateTotals.revenue) || 0, commissionPercent);

        const streamerPerformance = streamerPerfRaw.map((row) => {
            const extra = privateStreamerMap.get(String(row.id));
            const gross = Number(row.gross || 0) + Number(extra?.gross || 0);
            const tickets = Number(row.tickets || 0) + Number(extra?.tickets || 0);
            const part = splitRevenue(gross, commissionPercent);
            const liveViewers = liveShows
                .filter((s) => s.streamerId === row.id)
                .reduce((sum, s) => sum + (liveMap.get(s.id) || 0), 0);
            const archiveViews = archiveByShow
                .filter((s) => s.streamerId === row.id)
                .reduce((sum, s) => sum + s.views, 0);
            const ownShows = showIdRows.filter((s) => s.streamerId === row.id);
            const peakViewers = ownShows.reduce(
                (max, s) => Math.max(max, peakMap.get(s.id) || 0),
                0,
            );
            const avgVals = ownShows
                .map((s) => avgMap.get(s.id) || 0)
                .filter((n) => n > 0);
            const averageWatchSeconds = avgVals.length
                ? Math.round(avgVals.reduce((a, b) => a + b, 0) / avgVals.length)
                : 0;
            return {
                id: row.id,
                name: row.name,
                status: row.status,
                shows: row.shows,
                tickets,
                privateTickets: Number(extra?.tickets || 0),
                privateGross: Number(extra?.gross || 0),
                gross: part.gross,
                commission: part.commission,
                net: part.net,
                liveViewers,
                archiveViews,
                peakViewers,
                averageWatchSeconds,
            };
        });

        return {
            users,
            shows,
            archives,
            streamers,
            tickets: {
                total: Number(packTotals.tickets) || 0,
                paid: Number(packTotals.tickets) || 0,
                pending: Number(packPending.tickets) || 0,
                purchases: Number(packTotals.purchases) || 0,
                byCategory,
            },
            privateTickets: {
                paid: Number(privateTotals.paid) || 0,
                pending: Number(privateTotals.pending) || 0,
                revenue: Number(privateTotals.revenue) || 0,
                platformCommission: privateSplit.commission,
                streamerNet: privateSplit.net,
                purchases: privatePurchases.map((row) => ({
                    requestId: row.requestId,
                    ticketId: row.ticketId,
                    topic: row.topic,
                    showTitle: row.showTitle,
                    streamer: row.streamer,
                    viewerEmail: row.viewerEmail,
                    price: Number(row.price) || 0,
                    ticketStatus: row.ticketStatus,
                    requestStatus: row.requestStatus,
                    createdAt: row.createdAt,
                })),
            },
            revenue: {
                gross: saleSplit.gross,
                privateGross: privateSplit.gross,
                platformCommission: saleSplit.commission + privateSplit.commission,
                streamerNet: creditedSplit.net + privateSplit.net,
                creditedGross: creditedSplit.gross,
                commissionPercent: saleSplit.commissionPercent,
                paymentsSum: paymentsPaid._sum.amount || 0,
            },
            live: {
                now: liveByShow.reduce((sum, row) => sum + row.viewers, 0),
                peakViewers,
                byShow: liveByShow.sort((a, b) => b.viewers - a.viewers),
            },
            archiveViews: {
                total: await this.views.archiveViewTotal(),
                byShow: archiveByShow,
            },
            averageWatchSeconds,
            streamErrors,
            streamerPerformance,
            topShows,
            ticketRevenue: saleSplit.gross,
            paidTickets: Number(packTotals.tickets) || 0,
            giftTickets,
        };
    }

    listModerators() {
        return this.prisma.user.findMany({
            where: {
                OR: [
                    { role: USER_ROLES.MODERATOR },
                    { role: USER_ROLES.ADMIN },
                ],
            },
            select: { id: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });
    }

    async setUserRole(userIdOrEmail: string, role?: string) {
        const next = String(role || "").trim().toLowerCase();
        if (![USER_ROLES.USER, USER_ROLES.MODERATOR, USER_ROLES.STREAMER].includes(next as any)) {
            throw new BadRequestException("Itt csak user, moderator vagy tartalomkészítő szerep adható. Adminhoz külön folyamat kell.");
        }
        const key = userIdOrEmail.trim();
        const user = key.includes("@")
            ? await this.prisma.user.findUnique({ where: { email: key.toLowerCase() } })
            : await this.prisma.user.findUnique({ where: { id: key } });
        if (!user) throw new BadRequestException("A felhasználó nem található.");
        return this.prisma.user.update({
            where: { id: user.id },
            data: { role: next },
            select: { id: true, email: true, role: true },
        });
    }

    private assertShowInput(data: ShowInput) {
        if (!data.title?.trim()) {
            throw new BadRequestException("A cím kötelező.");
        }

        const start = data.startTime || data.date;
        const status = String(data.status || "draft").toLowerCase();
        if (!start && (status === "pending" || status === "active" || status === "archived")) {
            throw new BadRequestException("A dátum kötelező ehhez a státuszhoz.");
        }
    }
}

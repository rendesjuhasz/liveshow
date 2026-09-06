import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isApprovedStreamer, isStreamerStatus } from "./status";
import { computeStreamerRevenue } from "../payouts/revenue";
import { ReviewsService } from "./reviews.service";
import { MailService } from "../mail/mail.service";
import { TicketGroupsService } from "../tickets/ticket-groups.service";
import { PayoutsService } from "../payouts/payouts.service";
import { FollowsService } from "../follows/follows.service";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { privateShowIds } from "../private-streams/private-schema";
import { ViewLogService } from "../stats/view-log.service";

@Injectable()
export class StreamersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reviews: ReviewsService,
        private readonly mail: MailService,
        private readonly groups: TicketGroupsService,
        private readonly payouts: PayoutsService,
        private readonly follows: FollowsService,
        private readonly views: ViewLogService,
    ) {}

    async list() {
        const rows = await this.prisma.streamer.findMany({
            where: { status: "approved" },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                bio: true,
                avatarUrl: true,
                category: true,
                createdAt: true,
                shows: { select: { id: true, title: true } },
            },
        });
        const ratings = await this.reviews.ratingsForStreamerIds(rows.map((r) => r.id));
        return rows.map((row) => ({
            ...row,
            average: ratings.get(row.id)?.average || 0,
            reviewCount: ratings.get(row.id)?.count || 0,
        }));
    }

    payoutReceipt(id: string) {
        return this.payouts.receiptHtml(id);
    }

    leaderboard() {
        return this.payouts.publicLeaderboard();
    }

    async getPublicProfile(id: string, viewerUserId?: string) {
        const streamer = await this.prisma.streamer.findFirst({
            where: { id, status: "approved" },
            select: {
                id: true,
                name: true,
                bio: true,
                avatarUrl: true,
                category: true,
                createdAt: true,
                userId: true,
                shows: {
                    select: { id: true, title: true, startTime: true, live: true },
                    orderBy: { startTime: "desc" },
                },
            },
        });
        if (!streamer) {
            throw new NotFoundException("A streamer nem található.");
        }
        const { userId, ...publicStreamer } = streamer;
        const hidden = await privateShowIds(this.prisma).catch(() => new Set<string>());
        const reviews = await this.reviews.listForStreamer(id, false);
        const followerCount = await this.follows.followerCount(id);
        const following = await this.follows.isFollowing(viewerUserId, id);
        const publicShows = (publicStreamer.shows || []).filter((s) => !hidden.has(s.id));
        const viewCounts = await this.views.countsByShowIds(publicShows.map((s) => s.id));
        const liveMap = this.views.liveByShow();
        return {
            ...publicStreamer,
            shows: publicShows.map((s) => ({
                ...s,
                viewCount: viewCounts.get(s.id) || 0,
                viewerCount: s.live ? liveMap.get(s.id) || 0 : 0,
            })),
            ...reviews,
            followerCount,
            following,
            isOwn: Boolean(viewerUserId && userId && viewerUserId === userId),
        };
    }

    listAll() {
        return this.prisma.streamer.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                shows: { select: { id: true, title: true } },
                user: { select: { id: true, email: true, role: true } },
            },
        });
    }

    async create(data: {
        name?: string;
        email?: string;
        bio?: string;
        userId?: string;
        category?: string;
        contactEmail?: string;
        avatarUrl?: string;
    }) {
        if (!data.name?.trim() || !data.email?.trim()) {
            throw new BadRequestException("Név és email kötelező.");
        }
        const email = data.email.trim().toLowerCase();
        assertNoOffPlatformContact(data.bio, data.name);
        return this.prisma.streamer.create({
            data: {
                name: data.name.trim(),
                email,
                bio: data.bio?.trim() || null,
                userId: data.userId?.trim() || null,
                category: data.category?.trim() || "egyeb",
                contactEmail: data.contactEmail?.trim().toLowerCase() || email,
                avatarUrl: data.avatarUrl?.trim() || null,
                status: "approved",
            },
        });
    }

    async remove(id: string) {
        await this.prisma.streamer.delete({ where: { id } }).catch(() => {
            throw new NotFoundException("A streamer nem található.");
        });
        return { deleted: true };
    }

    async setStatus(id: string, status?: string) {
        const next = String(status || "").trim().toLowerCase();
        if (!isStreamerStatus(next)) {
            throw new BadRequestException(
                "Érvénytelen státusz. pending, approved, rejected vagy banned.",
            );
        }
        const streamer = await this.prisma.streamer.findUnique({ where: { id } });
        if (!streamer) {
            throw new NotFoundException("A streamer nem található.");
        }
        const updated = await this.prisma.streamer.update({
            where: { id },
            data: { status: next },
        });
        if (next === "approved" && streamer.status !== "approved") {
            void this.mail.streamerApproved(updated.id);
        }
        if (streamer.userId) {
            const userStatus = next === "banned" ? "banned" : "active";
            await this.prisma.$executeRaw`
                UPDATE "User" SET status = ${userStatus}, "updatedAt" = NOW() WHERE id = ${streamer.userId}
            `;
        }
        return updated;
    }

    async getDashboard(user: { id: string; email: string }) {
        let streamer = await this.prisma.streamer.findFirst({
            where: {
                OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
            },
            include: {
                payouts: { orderBy: { createdAt: "desc" } },
                shows: { orderBy: { startTime: "desc" } },
            },
        });

        if (streamer && !streamer.userId) {
            streamer = await this.prisma.streamer.update({
                where: { id: streamer.id },
                data: { userId: user.id },
                include: {
                    payouts: { orderBy: { createdAt: "desc" } },
                    shows: { orderBy: { startTime: "desc" } },
                },
            });
        }

        if (!streamer) {
            return { streamer: null, allowed: false, shows: [], payouts: [], stats: null };
        }

        if (!isApprovedStreamer(streamer.status)) {
            return {
                streamer: {
                    id: streamer.id,
                    name: streamer.name,
                    email: streamer.email,
                    bio: streamer.bio,
                    avatarUrl: streamer.avatarUrl,
                    category: streamer.category,
                    status: streamer.status,
                },
                allowed: false,
                shows: [],
                payouts: [],
                stats: null,
            };
        }

        const money = await computeStreamerRevenue(this.prisma, streamer.id);
        const ratings = await this.reviews.ratingsForStreamerIds([streamer.id]);
        const reviewCount = ratings.get(streamer.id)?.count || 0;
        const follow = await this.follows.dashboardStats(streamer.id);
        const viewStats = await this.views.streamerStats(
            streamer.id,
            streamer.shows.map((s) => ({ id: s.id, title: s.title })),
        );

        return {
            streamer,
            allowed: true,
            shows: streamer.shows,
            payouts: streamer.payouts,
            follow,
            viewStats,
            stats: {
                shows: streamer.shows.length,
                revenue: money.net,
                gross: money.gross,
                commission: money.commission,
                available: money.available,
                payouts: money.paidOut,
                reviews: reviewCount,
                reviewAverage: money.reviewAverage,
                ticketsSold: money.ticketsSold,
                payoutDue: money.payoutDue,
                followerCount: follow.followerCount,
                newFollowers7d: follow.newFollowers7d,
                totalViews: viewStats.totalViews,
                averageLiveViewers: viewStats.averageLiveViewers,
            },
        };
    }

    async createOwn(user: { id: string; email: string }, data: { name?: string; bio?: string }) {
        const existing = await this.prisma.streamer.findFirst({
            where: {
                OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
            },
        });
        if (existing) {
            throw new BadRequestException("Már van streamer profilod.");
        }
        return this.prisma.streamer.create({
            data: {
                name: data.name?.trim() || user.email,
                email: user.email.toLowerCase(),
                bio: data.bio?.trim() || null,
                userId: user.id,
                category: "egyeb",
                contactEmail: user.email.toLowerCase(),
                status: "pending",
            },
        });
    }

    listPayouts() {
        return this.payouts.listAdmin();
    }

    ticketGroupReport() {
        return this.groups.reportAllStreamers();
    }

    createPayout(streamerId?: string, amount?: number) {
        if (!streamerId) throw new BadRequestException("Streamer kell.");
        return this.payouts.requestPayout({
            streamerId,
            amount,
            requestedBy: "admin",
        });
    }

    setPayoutStatus(id: string, status?: string, method?: string) {
        return this.payouts.setStatus(id, status, { method });
    }

    approvePayout(id: string) {
        return this.payouts.setStatus(id, "approved");
    }

    markPayoutPaid(id: string, method?: string) {
        return this.payouts.setStatus(id, "paid", { method });
    }

    rejectPayout(id: string) {
        return this.payouts.setStatus(id, "rejected");
    }
}

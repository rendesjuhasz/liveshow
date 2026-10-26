import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isApprovedStreamer, isStreamerStatus, initialStreamerStatus } from "./status";
import { computeStreamerRevenue } from "../payouts/revenue";
import { ReviewsService } from "./reviews.service";
import { MailService } from "../mail/mail.service";
import { TicketGroupsService } from "../tickets/ticket-groups.service";
import { PayoutsService } from "../payouts/payouts.service";
import { FollowsService } from "../follows/follows.service";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { privateShowIds } from "../private-streams/private-schema";
import { ViewLogService } from "../stats/view-log.service";
import { hashSecret, newOpaqueToken } from "../auth/secrets";
import { endedShowIdSet } from "../shows/show-ended";

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
                    select: {
                        id: true,
                        title: true,
                        image: true,
                        startTime: true,
                        endTime: true,
                        live: true,
                        streamId: true,
                        archiveExists: true,
                        status: true,
                        videoCategory: true,
                    },
                    orderBy: { startTime: "desc" },
                },
            },
        });
        if (!streamer) {
            throw new NotFoundException("A tartalomkészítő nem található.");
        }
        const { userId, ...publicStreamer } = streamer;
        const hidden = await privateShowIds(this.prisma).catch(() => new Set<string>());
        const reviews = await this.reviews.listForStreamer(id, false);
        const followerCount = await this.follows.followerCount(id);
        const following = await this.follows.isFollowing(viewerUserId, id);
        const publicShows = (publicStreamer.shows || []).filter((s) => !hidden.has(s.id));
        const viewCounts = await this.views.countsByShowIds(publicShows.map((s) => s.id));
        const liveMap = this.views.liveByShow();
        const endedIds = await endedShowIdSet(this.prisma, publicShows);
        return {
            ...publicStreamer,
            shows: publicShows.map((s) => ({
                id: s.id,
                title: s.title,
                image: s.image,
                startTime: s.startTime,
                startAtUtc: s.startTime,
                endAtUtc: s.endTime,
                live: s.live,
                streamId: s.streamId,
                exists: Boolean(s.archiveExists),
                status: s.status,
                videoCategory: s.videoCategory,
                ended: endedIds.has(s.id),
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
            throw new NotFoundException("A tartalomkészítő nem található.");
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
            throw new NotFoundException("A tartalomkészítő nem található.");
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
            where: { userId: user.id },
            include: {
                payouts: { orderBy: { createdAt: "desc" } },
                shows: { orderBy: { startTime: "desc" } },
            },
        });

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
                peakLiveViewers: viewStats.peakLiveViewers,
                averageWatchSeconds: viewStats.averageWatchSeconds,
            },
        };
    }

    async createOwn(user: { id: string; email: string }, data: { name?: string; bio?: string }) {
        const existing = await this.prisma.streamer.findFirst({
            where: { userId: user.id },
        });
        if (existing) {
            throw new BadRequestException("Már van tartalomkészítő profilod.");
        }
        const emailTaken = await this.prisma.streamer.findFirst({
            where: { email: user.email.toLowerCase() },
        });
        if (emailTaken) {
            throw new BadRequestException(
                "Ehhez az emailhez már tartozik tartalomkészítő profil. Az összerendelés csak admin linking tokennel lehetséges.",
            );
        }
        return this.prisma.streamer.create({
            data: {
                name: data.name?.trim() || user.email,
                email: user.email.toLowerCase(),
                bio: data.bio?.trim() || null,
                userId: user.id,
                category: "egyeb",
                contactEmail: user.email.toLowerCase(),
                status: initialStreamerStatus(),
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
        if (!streamerId) throw new BadRequestException("Tartalomkészítő kell.");
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

    async issueLinkToken(streamerId: string) {
        const streamer = await this.prisma.streamer.findUnique({ where: { id: streamerId } });
        if (!streamer) throw new NotFoundException("A tartalomkészítő nem található.");
        const raw = newOpaqueToken();
        const hash = hashSecret(raw);
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.prisma.$executeRaw`
            UPDATE "Streamer"
            SET "linkTokenHash" = ${hash},
                "linkTokenExpiresAt" = ${expires}
            WHERE id = ${streamerId}
        `;
        return { token: raw, expiresAt: expires.toISOString(), streamerId };
    }

    async claimLinkToken(user: { id: string; email: string }, token?: string) {
        const raw = String(token || "").trim();
        if (raw.length < 16) throw new BadRequestException("Érvénytelen linking token.");
        const hash = hashSecret(raw);
        const rows = await this.prisma.$queryRaw<
            { id: string; userId?: string | null; linkTokenExpiresAt?: Date | null }[]
        >`
            SELECT id, "userId", "linkTokenExpiresAt" FROM "Streamer"
            WHERE "linkTokenHash" = ${hash}
            LIMIT 1
        `;
        const row = rows[0];
        if (!row) throw new BadRequestException("Érvénytelen vagy felhasznált linking token.");
        if (!row.linkTokenExpiresAt || new Date(row.linkTokenExpiresAt).getTime() <= Date.now()) {
            throw new BadRequestException("A linking token lejárt.");
        }
        if (row.userId && row.userId !== user.id) {
            throw new ForbiddenException("Ez a tartalomkészítő profil már másik fiókhoz tartozik.");
        }
        const already = await this.prisma.streamer.findFirst({ where: { userId: user.id } });
        if (already && already.id !== row.id) {
            throw new BadRequestException("Ehhez a fiókhoz már tartozik tartalomkészítő profil.");
        }
        await this.prisma.$executeRaw`
            UPDATE "Streamer"
            SET "userId" = ${user.id},
                "linkTokenHash" = NULL,
                "linkTokenExpiresAt" = NULL
            WHERE id = ${row.id}
        `;
        return { ok: true, streamerId: row.id };
    }
}

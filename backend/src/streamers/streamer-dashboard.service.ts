import {
    BadRequestException,
    ForbiddenException,
    HttpException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IngestService } from "../ingest/ingest.service";
import { ArchiveService } from "../archive/archive.service";
import { TicketCategoriesService } from "../tickets/ticket-categories.service";
import { QuestionsService } from "../questions/questions.service";
import { PayoutsService } from "../payouts/payouts.service";
import { isStreamerCategory } from "./categories";
import { ReviewsService } from "./reviews.service";
import { LIVE_ALLOWED_STATUSES, normalizeShowStatus } from "../shows/show-status";
import { setShowStatus, withShowStatus, withShowStatuses } from "../shows/show-status-db";
import { sanitizeStreamId } from "../streaming/hls-paths";
import * as fs from "fs";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { videoCategoryFields } from "../shows/video-categories";
import {
    parseRequiredVideoCategory,
    setShowVideoCategory,
    videoCategoryByShowIds,
} from "../shows/video-category-db";
import { coverPublicPath } from "../uploads/vod-multer";
import { FollowNotifyService } from "../follows/follow-notify.service";
import { FollowsService } from "../follows/follows.service";
import { ViewLogService } from "../stats/view-log.service";

type StreamerRow = {
    id: string;
    name: string;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
    category: string;
    contactEmail: string;
    status: string;
    userId?: string | null;
};

function parsePublicStartTime(raw?: string) {
    const value = String(raw || "").trim();
    if (!value) {
        throw new BadRequestException(
            "A kezdés időpontja kötelező. Ettől jelenik meg a nézői oldalon a Hamarosan eseményeknél.",
        );
    }
    const start = new Date(value);
    if (Number.isNaN(start.getTime())) {
        throw new BadRequestException("Érvénytelen kezdési időpont.");
    }
    if (start.getTime() <= Date.now() - 60_000) {
        throw new BadRequestException(
            "A kezdésnek a jövőben kell lennie, különben a műsor nem a Hamarosan listába, hanem az archívumba kerül.",
        );
    }
    return start;
}

function toLocalStreamId(streamerId: string, title: string) {
    const slug = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24);
    const suffix = streamerId.replace(/-/g, "").slice(0, 6);
    return `${slug || "show"}-${suffix}-${Date.now().toString(36)}`;
}

@Injectable()
export class StreamerDashboardService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ingestService: IngestService,
        private readonly archiveService: ArchiveService,
        private readonly categories: TicketCategoriesService,
        private readonly questions: QuestionsService,
        private readonly reviews: ReviewsService,
        private readonly payouts: PayoutsService,
        private readonly followNotify: FollowNotifyService,
        private readonly follows: FollowsService,
        private readonly views: ViewLogService,
    ) {}

    private async ownShow(streamerId: string, showId: string) {
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        if (!show) throw new NotFoundException("A műsor nem található.");
        if (show.streamerId !== streamerId) {
            throw new ForbiddenException("Csak a saját műsorodat kezelheted.");
        }
        return show;
    }

    async listShows(streamer: StreamerRow) {
        const shows = await this.prisma.show.findMany({
            where: { streamerId: streamer.id },
            orderBy: { startTime: "desc" },
        });
        const tagged = await withShowStatuses(this.prisma, shows);
        const catMap = await videoCategoryByShowIds(this.prisma, tagged.map((show) => show.id));
        const viewCounts = await this.views.countsByShowIds(tagged.map((show) => show.id));
        const liveMap = this.views.liveByShow();
        return Promise.all(
            tagged.map(async (show) => ({
                ...show,
                ...videoCategoryFields(catMap.get(show.id)),
                viewCount: viewCounts.get(show.id) || 0,
                viewerCount: show.live ? liveMap.get(show.id) || 0 : 0,
                ticketCategories: await this.categories.offersForShow(show.id),
            })),
        );
    }

    async createShow(
        streamer: StreamerRow,
        data: {
            title?: string;
            description?: string;
            image?: string;
            startTime?: string;
            date?: string;
            price?: number | string;
            streamId?: string;
            streamUrl?: string;
            videoCategory?: string;
            categoryKeys?: string[];
        },
    ) {
        if (!data.title?.trim()) throw new BadRequestException("A cím kötelező.");
        const videoCategory = parseRequiredVideoCategory(data.videoCategory);
        const startAt = parsePublicStartTime(data.startTime || data.date);

        const streamId =
            data.streamId?.trim() || toLocalStreamId(streamer.id, data.title);

        const show = await this.prisma.show.create({
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                image: data.image?.trim() || null,
                startTime: startAt,
                price: 0,
                live: false,
                featured: false,
                streamId,
                streamUrl: data.streamUrl?.trim() || null,
                streamerId: streamer.id,
            } as any,
        });
        await setShowStatus(this.prisma, show.id, "active");
        await this.categories.setShowCategories(show.id, ["interaktiv"]);
        await setShowVideoCategory(this.prisma, show.id, videoCategory);
        void this.followNotify.notifyPublished(show.id).catch(() => undefined);
        return {
            ...show,
            status: "active",
            ...videoCategoryFields(videoCategory),
            ticketCategories: await this.categories.offersForShow(show.id),
        };
    }

    async uploadVod(
        streamer: StreamerRow,
        body: { title?: string; description?: string; videoCategory?: string },
        files: { video?: { filename: string; path: string; size: number; originalname: string }[]; cover?: { filename: string; path: string; size: number }[] },
    ) {
        const title = String(body.title || "").trim();
        const description = String(body.description || "").trim();
        if (!title) throw new BadRequestException("A cím kötelező.");
        if (description.length < 4) throw new BadRequestException("A leírás kötelező.");
        assertNoOffPlatformContact(title, description);
        const videoCategory = parseRequiredVideoCategory(body.videoCategory);
        const video = files.video?.[0];
        const cover = files.cover?.[0];
        if (!cover?.filename) throw new BadRequestException("A borítókép kötelező.");
        if (!video?.path) throw new BadRequestException("A videófájl kötelező.");
        if (Number(video.size || 0) < 8 * 1024) {
            throw new BadRequestException("A videófájl túl kicsi vagy üres.");
        }

        const streamId = toLocalStreamId(streamer.id, `vod-${title}`);
        const image = coverPublicPath(cover.filename);
        const show = await this.prisma.show.create({
            data: {
                title,
                description,
                image,
                startTime: new Date(),
                price: 0,
                live: false,
                featured: false,
                streamId,
                streamerId: streamer.id,
            } as any,
        });
        await this.prisma.$executeRaw`
            ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "isVod" BOOLEAN NOT NULL DEFAULT false
        `.catch(() => undefined);
        await this.prisma.$executeRaw`
            UPDATE "Show" SET "isVod" = true WHERE id = ${show.id}
        `.catch(() => undefined);
        await setShowVideoCategory(this.prisma, show.id, videoCategory);
        await this.categories.setShowCategories(show.id, ["interaktiv"]);

        try {
            const archive = await this.archiveService.ingestUploaded(show.id, video.path);
            return {
                ...show,
                image,
                status: "archived",
                isVod: true,
                ...videoCategoryFields(videoCategory),
                archive,
            };
        } catch (err: any) {
            await this.prisma.show.delete({ where: { id: show.id } }).catch(() => undefined);
            if (err instanceof HttpException) throw err;
            throw new BadRequestException(
                "A videó feldolgozása nem sikerült. Ellenőrizd, hogy az FFmpeg telepítve van-e, vagy tölts fel MP4 fájlt.",
            );
        } finally {
            fs.unlink(video.path, () => undefined);
        }
    }

    async getShow(streamer: StreamerRow, showId: string) {
        const show = await this.ownShow(streamer.id, showId);
        const tagged = await withShowStatus(this.prisma, show);
        const catMap = await videoCategoryByShowIds(this.prisma, [show.id]);
        return {
            ...tagged,
            ...videoCategoryFields(catMap.get(show.id)),
            ticketCategories: await this.categories.offersForShow(show.id),
        };
    }

    async submitShow(streamer: StreamerRow, showId: string) {
        const show = await this.ownShow(streamer.id, showId);
        const tagged = await withShowStatus(this.prisma, show);
        const status = normalizeShowStatus(tagged.status);
        if (status === "blocked") {
            throw new ForbiddenException("A tiltott műsort nem lehet beküldeni.");
        }
        if (status === "active" || status === "archived") {
            return tagged;
        }
        if (!show.title?.trim()) throw new BadRequestException("A cím kötelező a beküldéshez.");
        if (!show.startTime) {
            throw new BadRequestException("A kezdés időpontja kötelező a közzétételhez.");
        }
        if (new Date(show.startTime).getTime() <= Date.now() - 60_000) {
            throw new BadRequestException(
                "A kezdésnek a jövőben kell lennie, hogy a nézők a Hamarosan listában lássák.",
            );
        }
        await setShowStatus(this.prisma, show.id, "active");
        void this.followNotify.notifyPublished(show.id).catch(() => undefined);
        return { ...tagged, status: "active" };
    }

    async updateShow(
        streamer: StreamerRow,
        showId: string,
        data: {
            title?: string;
            description?: string;
            image?: string;
            startTime?: string;
            date?: string;
            price?: number | string;
            streamId?: string;
            streamUrl?: string;
            categoryKeys?: string[];
            extrasContent?: string;
            privateStreamId?: string;
            videoCategory?: string;
        },
    ) {
        await this.ownShow(streamer.id, showId);
        const current = await withShowStatus(
            this.prisma,
            await this.prisma.show.findUnique({ where: { id: showId } }) as any,
        );
        if (normalizeShowStatus(current.status) === "blocked") {
            throw new ForbiddenException("A tiltott műsort nem szerkesztheted.");
        }
        await this.prisma.show.update({
            where: { id: showId },
            data: {
                ...(data.title !== undefined ? { title: data.title.trim() } : {}),
                ...(data.description !== undefined
                    ? { description: data.description.trim() || null }
                    : {}),
                ...(data.image !== undefined ? { image: data.image.trim() || null } : {}),
                ...(data.startTime || data.date
                    ? { startTime: new Date(String(data.startTime || data.date)) }
                    : {}),
                ...(data.streamId !== undefined
                    ? { streamId: data.streamId.trim() || null }
                    : {}),
                ...(data.streamUrl !== undefined
                    ? { streamUrl: data.streamUrl.trim() || null }
                    : {}),
            },
        });
        if (data.videoCategory !== undefined) {
            await setShowVideoCategory(this.prisma, showId, parseRequiredVideoCategory(data.videoCategory));
        }
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        const catMap = await videoCategoryByShowIds(this.prisma, [showId]);
        return {
            ...show,
            ...videoCategoryFields(catMap.get(showId)),
            ticketCategories: await this.categories.offersForShow(showId),
        };
    }

    async setLive(
        streamer: StreamerRow,
        showId: string,
        body: { live?: boolean; streamId?: string; rtpPort?: number },
    ) {
        const show = await this.ownShow(streamer.id, showId);
        const tagged = await withShowStatus(this.prisma, show);
        if (body.live !== true && body.live !== false) {
            throw new BadRequestException("Az élő állapot (live) kötelező.");
        }
        const live = body.live === true;
        const streamId = sanitizeStreamId((body.streamId || show.streamId || "").trim());

        if (live) {
            if (!LIVE_ALLOWED_STATUSES.includes(normalizeShowStatus(tagged.status))) {
                throw new BadRequestException(
                    "Élő adást csak aktív (jóváhagyott) műsoron lehet indítani.",
                );
            }
            if (!streamId) {
                throw new BadRequestException("Élő adáshoz stream ID kell.");
            }
        }

        const wasLive = Boolean(show.live);
        const updated = await this.prisma.show.update({
            where: { id: show.id },
            data: {
                live,
                ...(streamId ? { streamId } : {}),
            },
        });

        if (streamId) {
            await this.prisma.stream.upsert({
                where: { streamKey: streamId },
                create: {
                    title: updated.title,
                    streamKey: streamId,
                    showId: updated.id,
                    isLive: live,
                },
                update: {
                    isLive: live,
                    showId: updated.id,
                    title: updated.title,
                },
            }).catch(() => null);
        }

        let ingest: unknown = null;
        if (live && streamId) {
            const rtpPort = Number(body.rtpPort) || 5004;
            try {
                ingest = await this.ingestService.startIngest(streamId, rtpPort);
            } catch (err: any) {
                ingest = { warning: err?.message || "Az ingest nem indult el." };
            }
        } else if (!live && streamId) {
            ingest = await this.ingestService.stopIngest(streamId);
            const bytes = Number((ingest as { recordingBytes?: number }).recordingBytes || 0);
            if (bytes < 1024) {
                ingest = {
                    ...(ingest as object),
                    archive: {
                        exists: false,
                        error:
                            "Nem volt rögzített kép/hang. Üres teszt (nincs kamerakép / OBS az RTP portra) nem kerül a visszanézésbe.",
                    },
                };
            } else {
                ingest = {
                    ...(ingest as object),
                    archive: { pending: true },
                };
                void this.archiveService.archiveAfterStop(show.id);
            }
        }

        const fresh = await this.prisma.show.findUnique({ where: { id: show.id } });
        if (live && !wasLive) {
            void this.followNotify.notifyGoingLive(show.id).catch(() => undefined);
        }
        return { show: { ...(fresh || updated), status: tagged.status }, ingest };
    }

    async updateProfile(
        streamer: StreamerRow,
        data: {
            name?: string;
            bio?: string;
            category?: string;
            contactEmail?: string;
            avatarUrl?: string;
        },
    ) {
        const name = data.name?.trim();
        const category = data.category?.trim().toLowerCase();
        const contactEmail = data.contactEmail?.trim().toLowerCase();

        if (name !== undefined && !name) {
            throw new BadRequestException("A név kötelező.");
        }
        if (category && !isStreamerCategory(category)) {
            throw new BadRequestException("Érvénytelen kategória.");
        }
        if (contactEmail !== undefined && !contactEmail) {
            throw new BadRequestException("A kapcsolattartási email kötelező.");
        }
        if (data.bio !== undefined) {
            assertNoOffPlatformContact(data.bio);
        }
        if (name) {
            assertNoOffPlatformContact(name);
        }

        const updated = await this.prisma.streamer.update({
            where: { id: streamer.id },
            data: {
                ...(name ? { name } : {}),
                ...(data.bio !== undefined ? { bio: data.bio.trim() || null } : {}),
                ...(category ? { category } : {}),
                ...(contactEmail ? { contactEmail } : {}),
                ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
            },
        });
        if (name && streamer.userId) {
            await this.prisma.user.update({
                where: { id: streamer.userId },
                data: { name },
            }).catch(() => undefined);
        }
        return updated;
    }

    getRevenue(streamer: StreamerRow) {
        return this.payouts.revenue(streamer.id);
    }

    async listPayouts(streamer: StreamerRow) {
        return this.payouts.listForStreamer(streamer.id);
    }

    requestPayout(streamer: StreamerRow, amount?: number, actorUserId?: string) {
        return this.payouts.requestPayout({
            streamerId: streamer.id,
            amount,
            actorUserId,
            requestedBy: "streamer",
        });
    }

    leaderboard() {
        return this.payouts.leaderboard();
    }

    receiptHtml(streamer: StreamerRow, payoutId: string) {
        return this.payouts.receiptHtml(payoutId, streamer.id);
    }

    legal(streamer: StreamerRow) {
        return this.payouts.legalForStreamer(streamer.id);
    }

    updateLegal(streamer: StreamerRow, body: any) {
        return this.payouts.updateLegal(streamer.id, body);
    }

    listApprovedQuestions(streamer: StreamerRow, showId?: string) {
        return this.questions.listApprovedForStreamer(streamer.id, showId);
    }

    fulfillCurrentQuestion(streamer: StreamerRow, showId?: string) {
        return this.questions.fulfillCurrent(streamer.id, showId);
    }

    rejectCurrentQuestion(streamer: StreamerRow, showId?: string) {
        return this.questions.rejectCurrent(streamer.id, showId);
    }

    listSupport(streamer: StreamerRow, showId?: string) {
        return this.questions.listSupportForStreamer(streamer.id, showId);
    }

    listReviews(streamer: StreamerRow) {
        return this.reviews.listForStreamer(streamer.id, true);
    }

    followStats(streamer: StreamerRow) {
        return this.follows.dashboardStats(streamer.id);
    }

    async viewStats(streamer: StreamerRow) {
        const shows = await this.prisma.show.findMany({
            where: { streamerId: streamer.id },
            select: { id: true, title: true },
        });
        return this.views.streamerStats(streamer.id, shows);
    }
}

import {
    BadRequestException,
    ForbiddenException,
    HttpException,
    Injectable,
    NotFoundException,
    Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IngestService } from "../ingest/ingest.service";
import { rtmpPullUrl } from "../ingest/ingest-ffmpeg";
import { ArchiveService } from "../archive/archive.service";
import { QuestionsService } from "../questions/questions.service";
import { PayoutsService } from "../payouts/payouts.service";
import { isStreamerCategory } from "./categories";
import { ReviewsService } from "./reviews.service";
import { LIVE_ALLOWED_STATUSES, normalizeShowStatus } from "../shows/show-status";
import { setShowStatus, withShowStatus, withShowStatuses } from "../shows/show-status-db";
import { shouldPersistMissed, showAudiencePhase, hasEverGoneLive } from "../shows/show-ended";
import { sanitizeStreamId } from "../streaming/hls-paths";
import * as fs from "fs";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { parseAndValidatePublicLinks } from "./public-links";
import { assertUploadedMedia } from "../uploads/upload-magic";
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
import { ReportsService } from "../moderation/reports.service";
import { ChatService } from "../moderation/chat.service";
import { parseScheduleInput } from "../time/timezone";
import { WebrtcGateway } from "../webrtc-signaling/webrtc.gateway";
import { I18nService } from "../i18n/i18n.service";
import { resolveOriginalLocale, type ShowTranslationInput } from "../i18n/show-content-translations";

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

function parsePublicStartTime(data: {
    startTime?: string;
    startLocal?: string;
    startAtUtc?: string;
    date?: string;
    timezone?: string;
    endLocal?: string;
    endAtUtc?: string;
    endTime?: string;
}) {
    const { startAtUtc, endAtUtc, timezone } = parseScheduleInput(data);
    if (!startAtUtc) {
        throw new BadRequestException(
            "A kezdés időpontja kötelező. Ettől jelenik meg a nézői oldalon a Hamarosan eseményeknél.",
        );
    }
    if (startAtUtc.getTime() <= Date.now() - 60_000) {
        throw new BadRequestException(
            "A kezdésnek a jövőben kell lennie.",
        );
    }
    return { startAtUtc, endAtUtc, timezone };
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
        private readonly questions: QuestionsService,
        private readonly reviews: ReviewsService,
        private readonly payouts: PayoutsService,
        private readonly followNotify: FollowNotifyService,
        private readonly follows: FollowsService,
        private readonly views: ViewLogService,
        private readonly reports: ReportsService,
        private readonly chat: ChatService,
        private readonly i18n: I18nService,
        @Optional() private readonly liveIo?: WebrtcGateway,
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
        for (const show of tagged) {
            if (show.live) continue;
            if (shouldPersistMissed(show)) {
                await setShowStatus(this.prisma, show.id, "missed").catch(() => undefined);
                show.status = "missed";
            }
        }
        const catMap = await videoCategoryByShowIds(this.prisma, tagged.map((show) => show.id));
        const ids = tagged.map((show) => show.id);
        const [viewCounts, peaks, avgs] = await Promise.all([
            this.views.countsByShowIds(ids),
            this.views.peaksByShowIds(ids),
            this.views.averageWatchByShowIds(ids),
        ]);
        const liveMap = this.views.liveByShow();
        return Promise.all(
            tagged.map(async (show) => ({
                ...show,
                ...videoCategoryFields(catMap.get(show.id)),
                scheduleStatus: showAudiencePhase(show),
                viewCount: viewCounts.get(show.id) || 0,
                viewerCount: show.live ? liveMap.get(show.id) || 0 : 0,
                peakViewers: peaks.get(show.id) || 0,
                avgWatchSeconds: avgs.get(show.id) || 0,
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
            startLocal?: string;
            startAtUtc?: string;
            date?: string;
            timezone?: string;
            endLocal?: string;
            endAtUtc?: string;
            endTime?: string;
            price?: number | string;
            streamId?: string;
            streamUrl?: string;
            videoCategory?: string;
            originalLocale?: string;
            translations?: ShowTranslationInput[];
        },
    ) {
        if (!data.title?.trim()) throw new BadRequestException("A cím kötelező.");
        const videoCategory = parseRequiredVideoCategory(data.videoCategory);
        const schedule = parsePublicStartTime(data);

        const streamId =
            data.streamId?.trim() || toLocalStreamId(streamer.id, data.title);
        const originalLocale = resolveOriginalLocale(data.originalLocale);

        const show = await this.prisma.show.create({
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                image: data.image?.trim() || null,
                startTime: schedule.startAtUtc,
                timezone: schedule.timezone,
                price: 0,
                live: false,
                featured: false,
                streamId,
                streamUrl: data.streamUrl?.trim() || null,
                streamerId: streamer.id,
                originalLocale,
            } as any,
        });
        await setShowStatus(this.prisma, show.id, "active");
        await setShowVideoCategory(this.prisma, show.id, videoCategory);
        void this.followNotify.notifyPublished(show.id).catch(() => undefined);
        await this.persistSchedule(show.id, schedule);
        await this.i18n.persistShowTranslations(show.id, data.translations, originalLocale);
        return {
            ...show,
            originalLocale,
            status: "active",
            startAtUtc: schedule.startAtUtc,
            endAtUtc: schedule.endAtUtc,
            timezone: schedule.timezone,
            ...videoCategoryFields(videoCategory),
        };
    }

    private async persistSchedule(
        showId: string,
        schedule: { timezone: string; startAtUtc: Date | null; endAtUtc: Date | null } | null,
    ) {
        if (!schedule) return;
        await this.prisma.$executeRaw`
            UPDATE "Show"
            SET timezone = ${schedule.timezone}, "endTime" = ${schedule.endAtUtc}
            WHERE id = ${showId}
        `.catch(() => undefined);
    }

    async uploadVod(
        streamer: StreamerRow,
        body: { title?: string; description?: string; videoCategory?: string },
        files: {
            video?: { filename: string; path: string; size: number; originalname: string; mimetype?: string }[];
            cover?: { filename: string; path: string; size: number; mimetype?: string }[];
        },
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
        assertUploadedMedia(video.path, String((video as { mimetype?: string }).mimetype || "video/mp4"), "video");
        if (cover?.path) {
            assertUploadedMedia(cover.path, String((cover as { mimetype?: string }).mimetype || "image/jpeg"), "image");
        }
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
            UPDATE "Show" SET "isVod" = true WHERE id = ${show.id}
        `.catch(() => undefined);
        await setShowVideoCategory(this.prisma, show.id, videoCategory);

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

    async ingestLiveArchive(
        streamer: StreamerRow,
        showId: string,
        file?: { path?: string; size?: number; mimetype?: string; originalname?: string },
    ) {
        const show = await this.ownShow(streamer.id, showId);
        if (!file?.path) throw new BadRequestException("A felvétel fájl kötelező.");
        if (Number(file.size || 0) < 4 * 1024) {
            fs.unlink(file.path, () => undefined);
            throw new BadRequestException("A felvétel túl rövid vagy üres.");
        }
        try {
            assertUploadedMedia(file.path, String(file.mimetype || "video/webm"), "video");
        } catch (err) {
            fs.unlink(file.path, () => undefined);
            throw err;
        }
        try {
            const archive = await this.archiveService.ingestUploaded(show.id, file.path);
            return { ok: true, archive };
        } catch (err: unknown) {
            if (err instanceof HttpException) throw err;
            throw new BadRequestException(
                "A felvétel feldolgozása nem sikerült. Ellenőrizd, hogy az FFmpeg telepítve van-e.",
            );
        } finally {
            fs.unlink(file.path, () => undefined);
        }
    }

    async getShow(streamer: StreamerRow, showId: string) {
        const show = await this.ownShow(streamer.id, showId);
        const tagged = await withShowStatus(this.prisma, show);
        const catMap = await videoCategoryByShowIds(this.prisma, [show.id]);
        const translationRows = await this.i18n.contentFor("show", show.id);
        return {
            ...tagged,
            startAtUtc: tagged.startTime,
            endAtUtc: (tagged as any).endTime ?? null,
            timezone: (tagged as any).timezone || "Europe/Budapest",
            ...videoCategoryFields(catMap.get(show.id)),
            originalLocale: resolveOriginalLocale((tagged as any).originalLocale),
            translations: this.i18n.groupedShowTranslations(
                translationRows,
                (tagged as any).originalLocale,
            ),
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
            startLocal?: string;
            startAtUtc?: string;
            date?: string;
            timezone?: string;
            endLocal?: string;
            endAtUtc?: string;
            endTime?: string;
            price?: number | string;
            streamId?: string;
            streamUrl?: string;
            extrasContent?: string;
            privateStreamId?: string;
            videoCategory?: string;
            originalLocale?: string;
            translations?: ShowTranslationInput[];
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
        const originalLocale = resolveOriginalLocale(
            data.originalLocale !== undefined ? data.originalLocale : (current as any).originalLocale,
        );
        const hasSchedule =
            data.startLocal ||
            data.startTime ||
            data.startAtUtc ||
            data.date ||
            data.timezone ||
            data.endLocal ||
            data.endAtUtc ||
            data.endTime;
        const schedule = hasSchedule
            ? parseScheduleInput({
                  timezone: data.timezone || (current as any).timezone,
                  startLocal: data.startLocal,
                  endLocal: data.endLocal,
                  startTime: data.startTime,
                  startAtUtc: data.startAtUtc,
                  endTime: data.endTime,
                  endAtUtc: data.endAtUtc,
                  date: data.date,
              })
            : null;
        await this.prisma.show.update({
            where: { id: showId },
            data: {
                ...(data.title !== undefined ? { title: data.title.trim() } : {}),
                ...(data.description !== undefined
                    ? { description: data.description.trim() || null }
                    : {}),
                ...(data.image !== undefined ? { image: data.image.trim() || null } : {}),
                ...(schedule?.startAtUtc ? { startTime: schedule.startAtUtc } : {}),
                ...(schedule ? { timezone: schedule.timezone } : {}),
                ...(data.streamId !== undefined
                    ? { streamId: data.streamId.trim() || null }
                    : {}),
                ...(data.streamUrl !== undefined
                    ? { streamUrl: data.streamUrl.trim() || null }
                    : {}),
                originalLocale,
            } as any,
        });
        await this.persistSchedule(showId, schedule);
        if (data.videoCategory !== undefined) {
            await setShowVideoCategory(this.prisma, showId, parseRequiredVideoCategory(data.videoCategory));
        }
        await this.i18n.persistShowTranslations(showId, data.translations, originalLocale);
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        const catMap = await videoCategoryByShowIds(this.prisma, [showId]);
        return {
            ...show,
            ...videoCategoryFields(catMap.get(showId)),
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
        let streamId = sanitizeStreamId((body.streamId || show.streamId || "").trim());
        if (live && !streamId) {
            streamId = sanitizeStreamId(toLocalStreamId(streamer.id, show.title || "show"));
        }

        if (live) {
            const status = normalizeShowStatus(tagged.status);
            if (status === "blocked") {
                throw new BadRequestException("Ez a műsor tiltva van, élő adás nem indítható.");
            }
            const allowed =
                LIVE_ALLOWED_STATUSES.includes(status) ||
                status === "archived" ||
                status === "pending" ||
                status === "draft";
            if (!allowed) {
                throw new BadRequestException(
                    "Élő adást csak saját, nem tiltott műsoron lehet indítani.",
                );
            }
            if (status !== "active") {
                await setShowStatus(this.prisma, show.id, "active");
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
        if (live) {
            await this.prisma.$executeRaw`
                UPDATE "Show" SET "wentLiveAt" = COALESCE("wentLiveAt", NOW()) WHERE id = ${show.id}
            `.catch(() => undefined);
        }

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
            ingest = {
                status: "awaiting_rtmp",
                streamId,
                rtmp: rtmpPullUrl(streamId),
            };
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
        if (!live) {
            this.liveIo?.emitLiveEnded(show.id);
            const everLive = wasLive || hasEverGoneLive({
                live: false,
                status: tagged.status,
                wentLiveAt: (show as { wentLiveAt?: Date | null }).wentLiveAt,
            });
            if (everLive) {
                await setShowStatus(this.prisma, show.id, "archived");
                await this.questions.markUnansweredMissedOnLiveStop(show.id).catch(() => undefined);
            }
        }
        if (live && !wasLive) {
            void this.followNotify.notifyGoingLive(show.id).catch(() => undefined);
        }
        const nextStatus = live
            ? "active"
            : wasLive || hasEverGoneLive({ live: false, status: tagged.status, wentLiveAt: (show as { wentLiveAt?: Date | null }).wentLiveAt })
              ? "archived"
              : tagged.status;
        return { show: { ...(fresh || updated), status: nextStatus }, ingest };
    }

    async updateProfile(
        streamer: StreamerRow,
        data: {
            name?: string;
            bio?: string;
            category?: string;
            contactEmail?: string;
            avatarUrl?: string;
            publicLinks?: unknown;
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

        const links =
            data.publicLinks !== undefined ? parseAndValidatePublicLinks(data.publicLinks) : undefined;

        const updated = await this.prisma.streamer.update({
            where: { id: streamer.id },
            data: {
                ...(name ? { name } : {}),
                ...(data.bio !== undefined ? { bio: data.bio.trim() || null } : {}),
                ...(category ? { category } : {}),
                ...(contactEmail ? { contactEmail } : {}),
                ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
                ...(links !== undefined ? { publicLinks: links } : {}),
            } as any,
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

    listQuestionQueue(streamer: StreamerRow, showId?: string) {
        return this.questions.listQueueForStreamer(streamer.id, showId);
    }

    rejectQueuedQuestion(streamer: StreamerRow, questionId: string, note?: string) {
        return this.questions.reviewForStreamer(streamer.id, questionId, "rejected", note);
    }

    listReports(streamer: StreamerRow, status?: string) {
        return this.reports.listForStreamer(streamer.id, status);
    }

    resolveReport(streamer: StreamerRow, reportId: string, status?: string, note?: string) {
        const actorId = String(streamer.userId || "");
        if (!actorId) throw new ForbiddenException("A tartalomkészítő fiókhoz nincs felhasználó.");
        return this.reports.resolveForStreamer(streamer.id, actorId, reportId, status, note);
    }

    listChat(streamer: StreamerRow, showId?: string) {
        return this.chat.listForModeration(showId || "", { streamerId: streamer.id });
    }

    hideChat(streamer: StreamerRow, messageId: string) {
        return this.chat.hide(
            { streamerId: streamer.id, userId: String(streamer.userId || "") },
            messageId,
        );
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

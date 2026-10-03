import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GiftCampaignsService } from "../tickets/gift-campaigns.service";
import {
    idsByShowStatus,
    setShowStatus,
    withShowStatus,
    withShowStatuses,
} from "./show-status-db";
import {
    isShowStatus,
    normalizeShowStatus,
    PUBLIC_CATALOG_STATUSES,
    PUBLIC_DETAIL_STATUSES,
    type ShowStatus,
} from "./show-status";
import { endedShowIdSet, shouldPersistMissed } from "./show-ended";
import { publicFrontendUrl } from "../auth/public-url";
import { I18nService } from "../i18n/i18n.service";
import { privateShowIds } from "../private-streams/private-schema";
import { VIDEO_CATEGORIES, videoCategoryFields, isVideoCategory } from "./video-categories";
import {
    ensureVideoCategoryColumn,
    parseRequiredVideoCategory,
    setShowVideoCategory,
    videoCategoryByShowIds,
} from "./video-category-db";
import { FollowNotifyService } from "../follows/follow-notify.service";
import { ViewLogService } from "../stats/view-log.service";
import {
    defaultEndUtc,
    parseScheduleInput,
    scheduleStatus,
    buildIcs,
} from "../time/timezone";
import { CACHE_TTL, PublicTtlCache } from "../cache/public-cache.module";

function cleanOptional(value?: string | null) {
    const v = value?.trim();
    if (!v) return null;
    if (v.includes("{streamId}") || v.includes("%7BstreamId%7D") || v === "{id}") {
        return null;
    }
    return v;
}

function toShowDto(show: any) {
    const startAtUtc = show.startTime ? new Date(show.startTime).toISOString() : null;
    const endAtUtc = show.endTime ? new Date(show.endTime).toISOString() : null;
    const timezone = show.timezone || "Europe/Budapest";
        const live = Boolean(show.live);
        const status = scheduleStatus({
            startAtUtc: show.startTime,
            endAtUtc: show.endTime,
            live,
            showStatus: show.status,
            wentLiveAt: show.wentLiveAt,
        });
        return {
            id: show.id,
            title: show.title,
            description: show.description ?? null,
            image: show.image ?? null,
            streamUrl: show.streamUrl ?? null,
            streamId: show.streamId ?? null,
            streamerId: show.streamerId ?? null,
            streamer: show.streamer
                ? { id: show.streamer.id, name: show.streamer.name }
                : null,
            startTime: startAtUtc,
            startAtUtc,
            endAtUtc,
            timezone,
            scheduleStatus: status,
            wentLiveAt: show.wentLiveAt ? new Date(show.wentLiveAt).toISOString() : null,
            price: 0,
            live,
            featured: show.featured,
            status: normalizeShowStatus(show.status),
            createdAt: show.createdAt,
            updatedAt: show.updatedAt,
            hasExtras: Boolean(show.extrasContent),
            hasPrivateStream: Boolean(show.privateStreamId),
            watchFree: true,
            ended: status === "ended",
        ...videoCategoryFields(show.videoCategory),
    };
}

@Injectable()
export class ShowsService implements OnModuleInit {
    constructor(
        private prisma: PrismaService,
        private campaigns: GiftCampaignsService,
        private i18n: I18nService,
        private followNotify: FollowNotifyService,
        private views: ViewLogService,
        private readonly publicCache: PublicTtlCache,
    ) {}

    async onModuleInit() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "isVod" BOOLEAN NOT NULL DEFAULT false`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/Budapest'`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "endTime" TIMESTAMP(3)`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "wentLiveAt" TIMESTAMP(3)`,
        ).catch(() => undefined);
        await ensureVideoCategoryColumn(this.prisma).catch(() => undefined);
        const { ensurePrivateSchema } = await import("../private-streams/private-schema");
        await ensurePrivateSchema(this.prisma).catch(() => undefined);
    }

    private async attachVideoCategory<T extends { id: string }>(rows: T[]) {
        const map = await videoCategoryByShowIds(this.prisma, rows.map((row) => row.id));
        return rows.map((row) => ({ ...row, ...videoCategoryFields(map.get(row.id)) }));
    }

    listVideoCategories() {
        return VIDEO_CATEGORIES;
    }

    private async decorateShows<T extends { id: string }>(shows: T[]) {
        const promos = await this.campaigns.publicPromos(shows.map((show) => show.id));
        return shows.map((show) => ({
            ...toShowDto(show),
            promo: promos.get(show.id) ?? null,
        }));
    }

    private async byStatus(statuses: ShowStatus[], extraWhere: Record<string, unknown> = {}) {
        const ids = await idsByShowStatus(this.prisma, statuses);
        if (!ids.length) return [];
        const shows = await this.prisma.show.findMany({
            where: { id: { in: ids }, ...extraWhere },
            orderBy: { startTime: "asc" },
            include: { streamer: true },
        });
        const hidden = await privateShowIds(this.prisma);
        const publicShows = shows.filter((show) => !hidden.has(show.id));
        const withStatus = await withShowStatuses(this.prisma, publicShows);
        for (const show of withStatus) {
            if (shouldPersistMissed(show)) {
                await setShowStatus(this.prisma, show.id, "missed").catch(() => undefined);
                show.status = "missed";
            }
        }
        const endedIds = await endedShowIdSet(this.prisma, withStatus);
        const withTopic = await this.attachVideoCategory(withStatus);
        const decorated = await this.decorateShows(withTopic);
        const rows = decorated.map((dto) => ({
            ...dto,
            ended: endedIds.has(dto.id) || dto.ended,
        }));
        return this.attachPopularity(rows);
    }

    private async attachPopularity<T extends { id: string; live?: boolean }>(rows: T[]) {
        if (!rows.length) return rows;
        const counts = await this.views.countsByShowIds(rows.map((row) => row.id));
        const liveMap = this.views.liveByShow();
        return rows.map((row) => ({
            ...row,
            viewCount: counts.get(row.id) || 0,
            viewerCount: row.live ? liveMap.get(row.id) || 0 : 0,
        }));
    }

    async getAllShows(lang = "hu") {
        return this.publicCache.getOrSet(`shows:all:${lang}`, CACHE_TTL.shows, async () => {
            const rows = await this.byStatus(PUBLIC_CATALOG_STATUSES);
            return this.i18n.localizeShows(
                rows.filter((show) => show.scheduleStatus !== "ended" && show.scheduleStatus !== "missed"),
                lang,
            );
        });
    }

    async getFeaturedShows(lang = "hu") {
        return this.publicCache.getOrSet(`shows:featured:${lang}`, CACHE_TTL.featured, async () => {
            const featured = (await this.byStatus(PUBLIC_CATALOG_STATUSES, { featured: true })).filter(
                (show) => show.scheduleStatus !== "ended" && show.scheduleStatus !== "missed",
            );
            if (featured.length > 0) return this.i18n.localizeShows(featured, lang);
            const active = await this.getAllShows(lang);
            return active.slice(0, 6);
        });
    }

    async getLiveShows(lang = "hu") {
        return this.publicCache.getOrSet(`shows:live:${lang}`, CACHE_TTL.live, async () =>
            this.i18n.localizeShows(await this.byStatus(PUBLIC_CATALOG_STATUSES, { live: true }), lang),
        );
    }

    async getShowById(id: string, opts?: { allowHidden?: boolean; lang?: string }) {
        const show = await this.prisma.show.findUnique({
            where: { id },
            include: { streamer: true },
        });

        if (!show) {
            throw new NotFoundException("A műsor nem található.");
        }

        const withStatus = await withShowStatus(this.prisma, show);
        const hidden = await privateShowIds(this.prisma);
        if (!opts?.allowHidden && hidden.has(show.id)) {
            throw new NotFoundException("A műsor nem található.");
        }
        if (
            !opts?.allowHidden &&
            !PUBLIC_DETAIL_STATUSES.includes(normalizeShowStatus(withStatus.status))
        ) {
            throw new NotFoundException("A műsor nem található.");
        }

        const [dto] = await this.decorateShows([withStatus]);
        const [withTopic] = await this.attachVideoCategory([{ ...dto, id: show.id }]);
        const endedIds = await endedShowIdSet(this.prisma, [withStatus]);
        const [localized] = await this.i18n.localizeShows(
            [{ ...withTopic, ended: endedIds.has(show.id) || withTopic.ended }],
            opts?.lang || "hu",
        );
        const [withPop] = await this.attachPopularity([localized]);
        return withPop;
    }

    listTracks(showId: string) {
        return this.i18n.tracks(showId);
    }

    async searchShows(q: string, lang = "hu", category?: string) {
        const needle = q.trim();
        const wanted = isVideoCategory(String(category || "").trim().toLowerCase())
            ? String(category).trim().toLowerCase()
            : "";
        let rows = await this.byStatus(PUBLIC_DETAIL_STATUSES);
        if (wanted) {
            rows = rows.filter((show) => show.videoCategory === wanted);
        }
        if (!needle) return this.i18n.localizeShows(wanted ? rows : rows.slice(0, 24), lang);
        const lower = needle.toLowerCase();
        const translatedIds = await this.i18n.searchContentIds("show", needle, lang);
        const hits = rows.filter((show) => {
            const title = String(show.title || "").toLowerCase();
            const desc = String(show.description || "").toLowerCase();
            const cat = String(show.videoCategory || "").toLowerCase();
            const catLabel = String(show.videoCategoryLabel || "").toLowerCase();
            const streamer = String(show.streamer?.name || "").toLowerCase();
            return (
                title.includes(lower) ||
                desc.includes(lower) ||
                cat.includes(lower) ||
                catLabel.includes(lower) ||
                streamer.includes(lower) ||
                translatedIds.has(show.id)
            );
        });
        return this.i18n.localizeShows(hits, lang);
    }

    listAllForAdmin() {
        return this.prisma.show
            .findMany({
                orderBy: { createdAt: "desc" },
                include: { streamer: true },
            })
            .then(async (shows) => {
                const withStatus = await withShowStatuses(this.prisma, shows);
                const withTopic = await this.attachVideoCategory(withStatus);
                const ids = withTopic.map((show) => show.id);
                const [peaks, avgs] = await Promise.all([
                    this.views.peaksByShowIds(ids),
                    this.views.averageWatchByShowIds(ids),
                ]);
                const decorated = await this.decorateShows(withTopic);
                return decorated.map((show) => ({
                    ...show,
                    peakViewers: peaks.get(show.id) || 0,
                    avgWatchSeconds: avgs.get(show.id) || 0,
                }));
            });
    }

    async createShow(data: any) {
        const schedule = parseScheduleInput(data);
        const status: ShowStatus = isShowStatus(String(data.status || "").toLowerCase())
            ? (String(data.status).toLowerCase() as ShowStatus)
            : "draft";

        const show = await this.prisma.show.create({
            data: {
                title: data.title,
                description: data.description || null,
                image: data.image || null,
                startTime: schedule.startAtUtc as any,
                timezone: schedule.timezone,
                price: 0,
                live: Boolean(data.live),
                featured: Boolean(data.featured),
                streamUrl: cleanOptional(data.streamUrl),
                streamId: cleanOptional(data.streamId),
                streamerId: data.streamerId || null,
            } as any,
        });
        await this.persistTimezone(show.id, schedule);
        await setShowStatus(this.prisma, show.id, status);
        await setShowVideoCategory(this.prisma, show.id, parseRequiredVideoCategory(data.videoCategory));
        if (status === "active") {
            void this.followNotify.notifyPublished(show.id).catch(() => undefined);
        }
        return this.getShowById(show.id, { allowHidden: true });
    }

    async updateShow(id: string, data: any) {
        const before = await this.prisma.show.findUnique({ where: { id } });
        const beforeStatus = before ? (await withShowStatus(this.prisma, before)).status : null;
        const hasSchedule =
            data.startLocal ||
            data.endLocal ||
            data.startTime ||
            data.startAtUtc ||
            data.endTime ||
            data.endAtUtc ||
            data.date ||
            data.timezone;
        const schedule = hasSchedule
            ? parseScheduleInput({
                  timezone: data.timezone || (before as any)?.timezone,
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
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined
                    ? { description: data.description }
                    : {}),
                ...(data.image !== undefined ? { image: data.image } : {}),
                ...(schedule?.startAtUtc ? { startTime: schedule.startAtUtc } : {}),
                ...(schedule ? { timezone: schedule.timezone } : {}),
                price: 0,
                ...(data.live !== undefined ? { live: Boolean(data.live) } : {}),
                ...(data.featured !== undefined
                    ? { featured: Boolean(data.featured) }
                    : {}),
                ...(data.streamUrl !== undefined
                    ? { streamUrl: cleanOptional(data.streamUrl) }
                    : {}),
                ...(data.streamId !== undefined
                    ? { streamId: cleanOptional(data.streamId) }
                    : {}),
                ...(data.streamerId !== undefined
                    ? { streamerId: data.streamerId || null }
                    : {}),
                ...(data.extrasContent !== undefined
                    ? { extrasContent: data.extrasContent?.trim() || null }
                    : {}),
                ...(data.privateStreamId !== undefined
                    ? { privateStreamId: data.privateStreamId?.trim() || null }
                    : {}),
            } as any,
        });
        if (schedule) await this.persistTimezone(id, schedule);
        if (data.status !== undefined) {
            const next = String(data.status || "").trim().toLowerCase();
            if (isShowStatus(next)) {
                await setShowStatus(this.prisma, id, next);
            }
        }
        if (data.videoCategory !== undefined) {
            await setShowVideoCategory(this.prisma, id, parseRequiredVideoCategory(data.videoCategory));
        }
        const nextStatus =
            data.status !== undefined && isShowStatus(String(data.status).trim().toLowerCase())
                ? String(data.status).trim().toLowerCase()
                : beforeStatus;
        if (nextStatus === "active" && beforeStatus !== "active") {
            void this.followNotify.notifyPublished(id).catch(() => undefined);
        }
        if (data.live === true && !before?.live) {
            void this.followNotify.notifyGoingLive(id).catch(() => undefined);
        }
        return this.getShowById(id, { allowHidden: true });
    }

    async deleteShow(id: string) {
        const show = await this.prisma.show.delete({
            where: { id },
        });
        return toShowDto(show);
    }

    async calendarIcs(id: string) {
        const show = await this.getShowById(id);
        const start = show.startAtUtc ? new Date(show.startAtUtc) : null;
        if (!start || Number.isNaN(start.getTime())) {
            throw new NotFoundException("Ehhez a műsorhoz nincs kezdési időpont.");
        }
        const end = show.endAtUtc ? new Date(show.endAtUtc) : defaultEndUtc(start);
        const base = publicFrontendUrl();
        const ics = buildIcs({
            title: show.title,
            description: show.description,
            url: `${base}/shows/${show.id}`,
            startAtUtc: start,
            endAtUtc: end,
            timezone: show.timezone || "Europe/Budapest",
        });
        return { ics, filename: `liveshow-${show.id}.ics` };
    }

    private async persistTimezone(
        showId: string,
        schedule: { timezone: string; startAtUtc: Date | null; endAtUtc: Date | null },
    ) {
        try {
            await this.prisma.$executeRaw`
                UPDATE "Show"
                SET timezone = ${schedule.timezone},
                    "endTime" = ${schedule.endAtUtc}
                WHERE id = ${showId}
            `;
        } catch {
            /* column may lag until migrate */
        }
    }
}

import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TicketCategoriesService } from "../tickets/ticket-categories.service";
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
import { endedShowIdSet } from "./show-ended";
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

function cleanOptional(value?: string | null) {
    const v = value?.trim();
    if (!v) return null;
    if (v.includes("{streamId}") || v.includes("%7BstreamId%7D") || v === "{id}") {
        return null;
    }
    return v;
}

function parseStartTime(data: any) {
    const raw = data.startTime || data.date;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toShowDto(show: any, ticketCategories: any[] = []) {
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
        startTime: show.startTime,
        price: 0,
        live: show.live,
        featured: show.featured,
        status: normalizeShowStatus(show.status),
        createdAt: show.createdAt,
        updatedAt: show.updatedAt,
        ticketCategories,
        hasExtras: Boolean(show.extrasContent),
        hasPrivateStream: Boolean(show.privateStreamId),
        watchFree: true,
        ended: false,
        ...videoCategoryFields(show.videoCategory),
    };
}

@Injectable()
export class ShowsService implements OnModuleInit {
    constructor(
        private prisma: PrismaService,
        private categories: TicketCategoriesService,
        private campaigns: GiftCampaignsService,
        private i18n: I18nService,
        private followNotify: FollowNotifyService,
        private views: ViewLogService,
    ) {}

    async onModuleInit() {
        await ensureVideoCategoryColumn(this.prisma).catch(() => undefined);
    }

    private async attachVideoCategory<T extends { id: string }>(rows: T[]) {
        const map = await videoCategoryByShowIds(this.prisma, rows.map((row) => row.id));
        return rows.map((row) => ({ ...row, ...videoCategoryFields(map.get(row.id)) }));
    }

    listVideoCategories() {
        return VIDEO_CATEGORIES;
    }

    private async withCategories(show: any) {
        const ticketCategories = await this.categories.offersForShow(show.id);
        const promo = await this.campaigns.publicPromo(show.id).catch(() => null);
        return { ...toShowDto(show, ticketCategories), promo };
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
        const endedIds = await endedShowIdSet(this.prisma, withStatus);
        const withTopic = await this.attachVideoCategory(withStatus);
        const rows = await Promise.all(
            withTopic.map(async (show) => {
                const dto = await this.withCategories(show);
                return { ...dto, ended: endedIds.has(show.id) };
            }),
        );
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
        const rows = await this.byStatus(PUBLIC_CATALOG_STATUSES);
        return this.i18n.localizeShows(rows.filter((show) => !show.ended), lang);
    }

    async getFeaturedShows(lang = "hu") {
        const featured = (await this.byStatus(PUBLIC_CATALOG_STATUSES, { featured: true })).filter(
            (show) => !show.ended,
        );
        if (featured.length > 0) return this.i18n.localizeShows(featured, lang);
        const active = await this.getAllShows(lang);
        return active.slice(0, 6);
    }

    async getLiveShows(lang = "hu") {
        return this.i18n.localizeShows(await this.byStatus(PUBLIC_CATALOG_STATUSES, { live: true }), lang);
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

        const dto = await this.withCategories(withStatus);
        const [withTopic] = await this.attachVideoCategory([{ ...dto, id: show.id }]);
        const endedIds = await endedShowIdSet(this.prisma, [withStatus]);
        const [localized] = await this.i18n.localizeShows(
            [{ ...withTopic, ended: endedIds.has(show.id) }],
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
        const upcoming = (await this.byStatus(PUBLIC_CATALOG_STATUSES)).filter((show) => !show.ended);
        const archived = await this.byStatus(["archived"]);
        let rows = [...upcoming, ...archived];
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
            return (
                title.includes(lower) ||
                desc.includes(lower) ||
                cat.includes(lower) ||
                catLabel.includes(lower) ||
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
                return Promise.all(withTopic.map((show) => this.withCategories(show)));
            });
    }

    async createShow(data: any) {
        const startTime = parseStartTime(data);
        const status: ShowStatus = isShowStatus(String(data.status || "").toLowerCase())
            ? (String(data.status).toLowerCase() as ShowStatus)
            : "draft";

        const show = await this.prisma.show.create({
            data: {
                title: data.title,
                description: data.description || null,
                image: data.image || null,
                startTime: startTime as any,
                price: 0,
                live: Boolean(data.live),
                featured: Boolean(data.featured),
                streamUrl: cleanOptional(data.streamUrl),
                streamId: cleanOptional(data.streamId),
                streamerId: data.streamerId || null,
            } as any,
        });
        await setShowStatus(this.prisma, show.id, status);
        await this.categories.setShowCategories(
            show.id,
            data.categoryKeys?.length ? data.categoryKeys : ["interaktiv"],
        );
        await setShowVideoCategory(this.prisma, show.id, parseRequiredVideoCategory(data.videoCategory));
        if (status === "active") {
            void this.followNotify.notifyPublished(show.id).catch(() => undefined);
        }
        return this.getShowById(show.id, { allowHidden: true });
    }

    async updateShow(id: string, data: any) {
        const before = await this.prisma.show.findUnique({ where: { id } });
        const beforeStatus = before ? (await withShowStatus(this.prisma, before)).status : null;
        await this.prisma.show.update({
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined
                    ? { description: data.description }
                    : {}),
                ...(data.image !== undefined ? { image: data.image } : {}),
                ...(data.startTime || data.date
                    ? { startTime: new Date(data.startTime || data.date) }
                    : {}),
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
            },
        });
        if (data.status !== undefined) {
            const next = String(data.status || "").trim().toLowerCase();
            if (isShowStatus(next)) {
                await setShowStatus(this.prisma, id, next);
            }
        }
        if (data.categoryKeys !== undefined) {
            await this.categories.setShowCategories(id, data.categoryKeys);
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
}

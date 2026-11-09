import {
    Injectable,
    Logger,
    NotFoundException,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { FfmpegPipeline } from "../streaming/ffmpeg-pipeline";
import {
    getArchiveFile,
    getArchivePublicPath,
    getPreviewFile,
    getPreviewPublicPath,
    getRecordingFile,
} from "../streaming/hls-paths";
import { idsByShowStatus, setShowStatus, withShowStatus, withShowStatuses } from "../shows/show-status-db";
import { PUBLIC_DETAIL_STATUSES, normalizeShowStatus } from "../shows/show-status";
import { endedShowIdSet } from "../shows/show-ended";
import { I18nService } from "../i18n/i18n.service";
import { promises as fsp } from "fs";
import {
    BACKUP_DAYS,
    backupRoot,
    ensureBackupDir,
    newId,
    privateShowIds,
} from "../private-streams/private-schema";
import * as path from "path";
import { VIDEO_CATEGORIES, videoCategoryFields } from "../shows/video-categories";
import {
    parseOptionalVideoCategory,
    videoCategoryByShowIds,
} from "../shows/video-category-db";
import { ViewLogService, type ArchiveSort } from "../stats/view-log.service";
import { fileSize, pathExists } from "../streaming/fs-async";
import { CACHE_TTL, PublicTtlCache } from "../cache/public-cache.module";
import { readStoredPublicLinks } from "../streamers/public-links";
import { isApprovedStreamer } from "../streamers/status";
import { COVER_DIR, ensureVodDirs } from "../uploads/vod-multer";
import {
    autoPosterFileName,
    autoPosterStoredPath,
    shouldReplaceShowImage,
} from "../streaming/show-poster";

@Injectable()
export class ArchiveService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ArchiveService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private startup: ReturnType<typeof setTimeout> | null = null;
    private backfillRunning = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly ffmpeg: FfmpegPipeline,
        private readonly mail: MailService,
        private readonly i18n: I18nService,
        private readonly views: ViewLogService,
        private readonly publicCache: PublicTtlCache,
    ) {}

    onModuleInit() {
        void this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveExists" BOOLEAN NOT NULL DEFAULT false`,
        ).catch(() => undefined);
        void this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveSize" INTEGER NOT NULL DEFAULT 0`,
        ).catch(() => undefined);
        void this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveDuration" INTEGER NOT NULL DEFAULT 0`,
        ).catch(() => undefined);
        void this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveCreatedAt" TIMESTAMP(3)`,
        ).catch(() => undefined);
        void this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Archive" ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 0`,
        ).catch(() => undefined);
        void this.prisma
            .$executeRawUnsafe(`ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "publicLinks" JSONB`)
            .catch(() => undefined);
        this.startup = setTimeout(() => {
            void this.backfillStoppedArchives();
        }, 15_000);
        this.timer = setInterval(() => {
            void this.backfillStoppedArchives();
        }, 60_000);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
        if (this.startup) clearTimeout(this.startup);
    }

    private async resolveStreamId(showId: string) {
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            include: { archives: true },
        });

        if (!show) {
            throw new NotFoundException("A műsor nem található.");
        }

        const streamId = show.streamId?.trim();
        if (!streamId) {
            throw new NotFoundException(
                "A műsorhoz nincs stream ID. Add meg adminban.",
            );
        }

        return { show, streamId };
    }

    private bustCatalogCache() {
        this.publicCache.deletePrefix("archives:");
        this.publicCache.deletePrefix("home:");
        this.publicCache.deletePrefix("shows:");
    }

    private metaFromShow(
        show: {
            archiveExists?: boolean | null;
            archiveSize?: number | null;
            archiveDuration?: number | null;
            archiveCreatedAt?: Date | string | null;
            archives?: { filePath?: string | null; publicPath?: string | null; size?: number | null; duration?: number | null; createdAt?: Date | string | null } | null;
        },
        streamId: string,
    ) {
        const exists = Boolean(show.archiveExists);
        const created = show.archiveCreatedAt || show.archives?.createdAt || null;
        return {
            exists,
            streamId,
            filePath: exists ? show.archives?.filePath || getArchiveFile(streamId) : null,
            publicPath: exists
                ? show.archives?.publicPath || getArchivePublicPath(streamId)
                : getArchivePublicPath(streamId),
            size: Number(show.archiveSize || show.archives?.size || 0),
            duration: Number(show.archiveDuration || show.archives?.duration || 0),
            createdAt: created ? new Date(created).toISOString() : null,
        };
    }

    private async persistArchiveMeta(
        showId: string,
        streamId: string,
        info: {
            exists: boolean;
            filePath?: string | null;
            publicPath?: string | null;
            size?: number;
            createdAt?: string | null;
        },
        duration = 0,
    ) {
        const exists = Boolean(info.exists);
        const size = exists ? Math.min(Math.max(0, Number(info.size) || 0), 2_147_483_647) : 0;
        const seconds = exists ? Math.max(0, Number(duration) || 0) : 0;
        const createdAt = exists
            ? info.createdAt
                ? new Date(info.createdAt)
                : new Date()
            : null;
        await this.prisma.$executeRaw`
            UPDATE "Show"
            SET "archiveExists" = ${exists},
                "archiveSize" = ${size},
                "archiveDuration" = ${seconds},
                "archiveCreatedAt" = ${createdAt}
            WHERE id = ${showId}
        `.catch(() => undefined);

        if (!exists) {
            await this.prisma.archive.deleteMany({ where: { showId } });
            this.bustCatalogCache();
            return {
                exists: false,
                streamId,
                filePath: null,
                publicPath: getArchivePublicPath(streamId),
                size: 0,
                duration: 0,
                createdAt: null,
            };
        }

        const filePath = info.filePath || getArchiveFile(streamId);
        const publicPath = info.publicPath || getArchivePublicPath(streamId);
        await this.prisma.archive.upsert({
            where: { showId },
            create: {
                showId,
                filePath,
                publicPath,
                size,
            },
            update: {
                filePath,
                publicPath,
                size,
            },
        });
        await this.prisma.$executeRaw`
            UPDATE "Archive" SET duration = ${seconds} WHERE "showId" = ${showId}
        `.catch(() => undefined);
        this.bustCatalogCache();
        return {
            exists: true,
            streamId,
            filePath,
            publicPath,
            size,
            duration: seconds,
            createdAt: createdAt?.toISOString() || null,
        };
    }

    private async ensureAutoPoster(showId: string, filePath: string | null, duration: number) {
        if (!filePath || !(await pathExists(filePath))) return false;
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            select: { image: true },
        });
        if (!show || !shouldReplaceShowImage(show.image, showId)) return false;
        ensureVodDirs();
        const dest = path.join(COVER_DIR, autoPosterFileName(showId));
        const stored = autoPosterStoredPath(showId);
        if ((await fileSize(dest)) >= 200 && String(show.image || "").trim() === stored) {
            return false;
        }
        try {
            await this.ffmpeg.extractPoster(filePath, dest, duration);
        } catch (err: any) {
            this.logger.warn(`Borítókép ${showId}: ${err?.message || err}`);
            return false;
        }
        if ((await fileSize(dest)) < 200) return false;
        if (String(show.image || "").trim() !== stored) {
            await this.prisma.show
                .update({ where: { id: showId }, data: { image: stored } })
                .catch(() => undefined);
            this.bustCatalogCache();
        }
        return true;
    }

    private async syncPrismaArchive(showId: string, streamId: string, opts?: { poster?: boolean }) {
        const info = await this.ffmpeg.getArchiveInfo(streamId);
        const duration =
            info.exists && info.filePath ? await this.ffmpeg.probeDurationSeconds(info.filePath) : 0;
        const meta = await this.persistArchiveMeta(showId, streamId, info, duration);
        if (!info.exists) return meta;
        if (opts?.poster !== false) {
            await this.ensureAutoPoster(showId, meta.filePath, duration);
        }

        const recording = getRecordingFile(streamId);
        if (await pathExists(recording)) {
            const stream = await this.prisma.stream.findFirst({
                where: { OR: [{ showId }, { streamKey: streamId }] },
            });
            if (stream) {
                await this.prisma.recording.create({
                    data: {
                        streamId: stream.id,
                        showId,
                        fileUrl: recording,
                    },
                }).catch(() => undefined);
            }
        }

        return meta;
    }

    async ingestUploaded(showId: string, sourcePath: string) {
        const { show, streamId } = await this.resolveStreamId(showId);
        const filePath = await this.ffmpeg.ingestUploadedVideo(streamId, sourcePath);
        const info = await this.syncPrismaArchive(show.id, streamId);
        await setShowStatus(this.prisma, show.id, "archived");
        return {
            ...info,
            showId: show.id,
            title: show.title,
            streamId,
            filePath,
        };
    }

    async listPublicArchives(lang = "hu", category?: string, sort: ArchiveSort = "newest") {
        const cat = String(category || "");
        return this.publicCache.getOrSet(
            `archives:${lang}:${cat}:${sort}`,
            CACHE_TTL.archives,
            () => this.loadPublicArchives(lang, category, sort),
        );
    }

    private async loadPublicArchives(lang = "hu", category?: string, sort: ArchiveSort = "newest") {
        const wanted = parseOptionalVideoCategory(category);
        const publicIds = await idsByShowStatus(this.prisma, PUBLIC_DETAIL_STATUSES);
        if (!publicIds.length) return [];
        const dateOrder = sort === "oldest" ? "asc" : "desc";
        const shows = await this.prisma.show.findMany({
            where: { id: { in: publicIds }, archiveExists: true } as any,
            orderBy: { startTime: dateOrder },
            include: { archives: true, streamer: { include: { user: { select: { username: true } } } } },
        });
        const tagged = await withShowStatuses(this.prisma, shows);
        const endedIds = await endedShowIdSet(this.prisma, tagged);

        const hidden = await privateShowIds(this.prisma);
        const catMap = await videoCategoryByShowIds(this.prisma, tagged.map((show) => show.id));
        let rows = tagged
            .filter((show) => endedIds.has(show.id) && !hidden.has(show.id))
            .map((show) => {
                const streamId = show.streamId?.trim() || "";
                const meta = this.metaFromShow(show, streamId);
                const topic = videoCategoryFields(catMap.get(show.id));
                return {
                    showId: show.id,
                    id: show.id,
                    title: show.title,
                    description: show.description,
                    image: show.image,
                    startTime: show.startTime,
                    streamId: streamId || null,
                    publicPath: meta.publicPath,
                    size: meta.size,
                    duration: meta.duration,
                    createdAt: meta.createdAt,
                    streamer: String(show.streamer?.user?.username || "").trim() || null,
                    exists: meta.exists,
                    ended: true,
                    viewCount: 0,
                    ...topic,
                };
            })
            .filter((row) => row.exists)
            .filter((row) => !wanted || row.videoCategory === wanted);
        const ids = rows.map((r) => r.id);
        const counts = await this.views.countsByShowIds(ids);
        const recent = sort === "popular" ? await this.views.popularCounts(ids) : new Map<string, number>();
        rows = rows.map((row) => ({ ...row, viewCount: counts.get(row.id) || 0 }));
        if (sort === "popular" || sort === "views") {
            const order = this.views.sortIds(ids, sort, counts, recent);
            const pos = new Map(order.map((id, i) => [id, i]));
            rows.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
        }
        return this.i18n.localizeShows(rows, lang);
    }

    async previewSource(showId: string) {
        const { show, streamId } = await this.resolveStreamId(showId);
        const tagged = await withShowStatus(this.prisma, show);
        const hidden = (await privateShowIds(this.prisma)).has(show.id);
        if (hidden) {
            throw new NotFoundException("A műsor nem található.");
        }
        if (!PUBLIC_DETAIL_STATUSES.includes(normalizeShowStatus(tagged.status))) {
            throw new NotFoundException("A műsor nem található.");
        }
        const teaserPath = getPreviewFile(streamId);
        const hasTeaser = (await fileSize(teaserPath)) >= 1024;
        const hasFull = Boolean((show as { archiveExists?: boolean }).archiveExists);
        if (!hasTeaser && !hasFull) {
            throw new NotFoundException("Ehhez a műsorhoz még nincs visszanézhető felvétel.");
        }
        return {
            showId: show.id,
            streamId,
            hasTeaser,
            publicPath: hasTeaser ? getPreviewPublicPath(streamId) : getArchivePublicPath(streamId),
        };
    }

    listVideoCategories() {
        return VIDEO_CATEGORIES;
    }

    async getArchive(showId: string, opts?: { allowHidden?: boolean; lang?: string }) {
        const { show, streamId } = await this.resolveStreamId(showId);
        const tagged = await withShowStatus(this.prisma, show);
        const hidden = (await privateShowIds(this.prisma)).has(show.id);
        if (!opts?.allowHidden && hidden) {
            throw new NotFoundException("A műsor nem található.");
        }
        if (
            !opts?.allowHidden &&
            !PUBLIC_DETAIL_STATUSES.includes(normalizeShowStatus(tagged.status))
        ) {
            throw new NotFoundException("A műsor nem található.");
        }
        const info = this.metaFromShow(show, streamId);
        const [localized] = await this.i18n.localizeShows(
            [{ id: show.id, title: show.title, description: show.description }],
            opts?.lang || "hu",
        );
        const catMap = await videoCategoryByShowIds(this.prisma, [show.id]);
        const viewCount = await this.views.viewCount(show.id);
        let creatorLinks: { name: string; links: { label: string; url: string }[] } | null = null;
        if (show.streamerId) {
            const owner = await this.prisma.streamer.findUnique({
                where: { id: show.streamerId },
                include: { user: { select: { username: true } } },
            });
            if (owner && isApprovedStreamer(owner.status)) {
                const links = readStoredPublicLinks(
                    (owner as { publicLinks?: unknown }).publicLinks,
                );
                if (links.length) {
                    creatorLinks = {
                        name: String(owner.user?.username || "").trim() || "Tartalomkészítő",
                        links,
                    };
                }
            }
        }
        return {
            showId: show.id,
            title: localized.title,
            description: localized.description,
            image: show.image,
            startTime: show.startTime,
            streamer: undefined,
            creatorLinks,
            viewCount,
            ...videoCategoryFields(catMap.get(show.id)),
            ...info,
        };
    }

    async generateArchive(showId: string) {
        try {
            return await this.generateArchiveUnsafe(showId);
        } catch (err: any) {
            const message = String(err?.message || "Az archívum nem készült el.");
            if (!message.includes("Nincs rögzített videó")) {
                const show = await this.prisma.show.findUnique({ where: { id: showId } }).catch(() => null);
                void this.views.logStreamError({
                    showId,
                    streamId: show?.streamId,
                    message,
                    source: "archive",
                });
            }
            throw err;
        }
    }

    private async generateArchiveUnsafe(showId: string) {
        const { show, streamId } = await this.resolveStreamId(showId);
        const filePath = await this.ffmpeg.generateArchive(streamId);
        const info = await this.syncPrismaArchive(show.id, streamId);
        const hidden = (await privateShowIds(this.prisma)).has(show.id);
        if (hidden) {
            const reqs = await this.prisma.$queryRaw<any[]>`
                SELECT id FROM "PrivateRequest" WHERE "showId" = ${show.id} LIMIT 1
            `.catch(() => []);
            if (reqs[0] && (await pathExists(filePath))) {
                ensureBackupDir();
                const dest = path.join(backupRoot(), `${reqs[0].id}.mp4`);
                await fsp.copyFile(filePath, dest);
                const expiresAt = new Date(Date.now() + BACKUP_DAYS * 24 * 3600_000);
                const existing = await this.prisma.$queryRaw<any[]>`
                    SELECT id FROM "PrivateBackup" WHERE "requestId" = ${reqs[0].id} LIMIT 1
                `.catch(() => []);
                if (existing[0]) {
                    await this.prisma.$executeRaw`
                        UPDATE "PrivateBackup"
                        SET "filePath" = ${dest}, "expiresAt" = ${expiresAt}, "showId" = ${show.id}
                        WHERE id = ${existing[0].id}
                    `.catch(() => undefined);
                } else {
                    await this.prisma.$executeRaw`
                        INSERT INTO "PrivateBackup" ("id", "requestId", "showId", "filePath", "expiresAt")
                        VALUES (${newId()}, ${reqs[0].id}, ${show.id}, ${dest}, ${expiresAt})
                    `.catch(() => undefined);
                }
            }
            await setShowStatus(this.prisma, show.id, "archived");
            return { showId: show.id, title: show.title, ...info, filePath, privateBackup: true };
        }
        await setShowStatus(this.prisma, show.id, "archived");
        void this.mail.archiveReady(show.id);
        return {
            showId: show.id,
            title: show.title,
            ...info,
            filePath,
        };
    }

    async archiveAfterStop(showId: string) {
        try {
            return await this.generateArchive(showId);
        } catch (err: any) {
            return {
                showId,
                exists: false,
                error: err?.message || "Az archívum nem készült el.",
            };
        }
    }

    private async backfillStoppedArchives() {
        if (this.backfillRunning) return;
        this.backfillRunning = true;
        try {
        let posterBudget = 24;
        const shows = await this.prisma.show.findMany({
            where: { live: false },
            select: { id: true, streamId: true },
            take: 100,
        });
        for (const show of shows) {
            const streamId = show.streamId?.trim();
            if (!streamId) continue;
            const disk = await this.ffmpeg.getArchiveInfo(streamId);
            if (disk.exists) {
                const meta = await this.syncPrismaArchive(show.id, streamId, { poster: false });
                await setShowStatus(this.prisma, show.id, "archived").catch(() => undefined);
                if (posterBudget > 0 && (await this.ensureAutoPoster(show.id, meta.filePath, meta.duration))) {
                    posterBudget -= 1;
                }
                continue;
            }
            const recording = getRecordingFile(streamId);
            if ((await fileSize(recording)) < 1024) continue;
            try {
                await this.generateArchive(show.id);
            } catch {
                /* recording may still be unreadable */
            }
        }
        if (posterBudget > 0) {
            const liveShows = await this.prisma.show.findMany({
                where: { live: true },
                select: { id: true, streamId: true, image: true },
                take: 20,
            });
            for (const show of liveShows) {
                if (posterBudget <= 0) break;
                if (!shouldReplaceShowImage(show.image, show.id)) continue;
                const streamId = show.streamId?.trim();
                if (!streamId) continue;
                const recording = getRecordingFile(streamId);
                if ((await fileSize(recording)) < 80_000) continue;
                const duration = await this.ffmpeg.probeDurationSeconds(recording);
                if (await this.ensureAutoPoster(show.id, recording, duration)) posterBudget -= 1;
            }
        }
        } catch (err: any) {
            this.logger.warn(`Archívum backfill: ${err?.message || err}`);
        } finally {
            this.backfillRunning = false;
        }
    }

    async deleteArchive(showId: string) {
        const { show, streamId } = await this.resolveStreamId(showId);
        await this.ffmpeg.deleteArchive(streamId);
        const info = await this.persistArchiveMeta(
            show.id,
            streamId,
            { exists: false, size: 0, filePath: null, publicPath: null, createdAt: null },
            0,
        );
        return {
            showId: show.id,
            title: show.title,
            ...info,
        };
    }
}

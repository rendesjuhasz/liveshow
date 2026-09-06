import {
    Injectable,
    NotFoundException,
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
import * as fs from "fs";
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
    ensureVideoCategoryColumn,
    parseOptionalVideoCategory,
    videoCategoryByShowIds,
} from "../shows/video-category-db";
import { ViewLogService, type ArchiveSort } from "../stats/view-log.service";

@Injectable()
export class ArchiveService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ffmpeg: FfmpegPipeline,
        private readonly mail: MailService,
        private readonly i18n: I18nService,
        private readonly views: ViewLogService,
    ) {}

    private async resolveStreamId(showId: string) {
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
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

    private async syncPrismaArchive(showId: string, streamId: string) {
        const info = this.ffmpeg.getArchiveInfo(streamId);
        if (!info.exists) {
            await this.prisma.archive.deleteMany({ where: { showId } });
            return info;
        }

        await this.prisma.archive.upsert({
            where: { showId },
            create: {
                showId,
                filePath: info.filePath || getArchiveFile(streamId),
                publicPath: info.publicPath || getArchivePublicPath(streamId),
                size: info.size || 0,
            },
            update: {
                filePath: info.filePath || getArchiveFile(streamId),
                publicPath: info.publicPath || getArchivePublicPath(streamId),
                size: info.size || 0,
            },
        });

        const recording = getRecordingFile(streamId);
        if (fs.existsSync(recording)) {
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

        return info;
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
        await this.backfillStoppedArchives();
        await ensureVideoCategoryColumn(this.prisma);
        const wanted = parseOptionalVideoCategory(category);
        const publicIds = await idsByShowStatus(this.prisma, PUBLIC_DETAIL_STATUSES);
        if (!publicIds.length) return [];
        const dateOrder = sort === "oldest" ? "asc" : "desc";
        const shows = await this.prisma.show.findMany({
            where: { id: { in: publicIds } },
            orderBy: { startTime: dateOrder },
            include: { archives: true, streamer: true },
        });
        const tagged = await withShowStatuses(this.prisma, shows);
        const endedIds = await endedShowIdSet(this.prisma, tagged);

        const hidden = await privateShowIds(this.prisma);
        const catMap = await videoCategoryByShowIds(this.prisma, tagged.map((show) => show.id));
        let rows = tagged
            .filter((show) => endedIds.has(show.id) && !hidden.has(show.id))
            .map((show) => {
                const streamId = show.streamId?.trim();
                const disk = streamId ? this.ffmpeg.getArchiveInfo(streamId) : null;
                const row = show.archives;
                const exists = Boolean(disk?.exists || row);
                const topic = videoCategoryFields(catMap.get(show.id));
                return {
                    showId: show.id,
                    id: show.id,
                    title: show.title,
                    description: show.description,
                    image: show.image,
                    startTime: show.startTime,
                    streamId: streamId || null,
                    publicPath: disk?.publicPath || row?.publicPath || null,
                    size: disk?.size || row?.size || 0,
                    createdAt: disk?.createdAt || row?.createdAt,
                    streamer: show.streamer?.name || null,
                    exists,
                    ended: true,
                    viewCount: 0,
                    ...topic,
                };
            })
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
        const hasTeaser = fs.existsSync(teaserPath) && fs.statSync(teaserPath).size >= 1024;
        const archivePath = getArchiveFile(streamId);
        const recording = getRecordingFile(streamId);
        const hasFull =
            (fs.existsSync(archivePath) && fs.statSync(archivePath).size >= 1024) ||
            (fs.existsSync(recording) && fs.statSync(recording).size >= 1024);
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
        const info = await this.syncPrismaArchive(show.id, streamId);
        const [localized] = await this.i18n.localizeShows(
            [{ id: show.id, title: show.title, description: show.description }],
            opts?.lang || "hu",
        );
        const catMap = await videoCategoryByShowIds(this.prisma, [show.id]);
        const viewCount = await this.views.viewCount(show.id);
        return {
            showId: show.id,
            title: localized.title,
            description: localized.description,
            image: show.image,
            startTime: show.startTime,
            streamer: undefined,
            viewCount,
            ...videoCategoryFields(catMap.get(show.id)),
            ...info,
        };
    }

    async generateArchive(showId: string) {
        const { show, streamId } = await this.resolveStreamId(showId);
        const filePath = await this.ffmpeg.generateArchive(streamId);
        const info = await this.syncPrismaArchive(show.id, streamId);
        const hidden = (await privateShowIds(this.prisma)).has(show.id);
        if (hidden) {
            const reqs = await this.prisma.$queryRaw<any[]>`
                SELECT id FROM "PrivateRequest" WHERE "showId" = ${show.id} LIMIT 1
            `.catch(() => []);
            if (reqs[0] && fs.existsSync(filePath)) {
                ensureBackupDir();
                const dest = path.join(backupRoot(), `${reqs[0].id}.mp4`);
                fs.copyFileSync(filePath, dest);
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
        const shows = await this.prisma.show.findMany({
            where: { live: false },
            select: { id: true, streamId: true },
            take: 100,
        });
        for (const show of shows) {
            const streamId = show.streamId?.trim();
            if (!streamId) continue;
            const disk = this.ffmpeg.getArchiveInfo(streamId);
            if (disk.exists) {
                await this.syncPrismaArchive(show.id, streamId);
                await setShowStatus(this.prisma, show.id, "archived").catch(() => undefined);
                continue;
            }
            const recording = getRecordingFile(streamId);
            if (!fs.existsSync(recording) || fs.statSync(recording).size < 1024) continue;
            try {
                await this.generateArchive(show.id);
            } catch {
                /* recording may still be unreadable */
            }
        }
    }

    async deleteArchive(showId: string) {
        const { show, streamId } = await this.resolveStreamId(showId);
        const info = this.ffmpeg.deleteArchive(streamId);
        await this.prisma.archive.deleteMany({ where: { showId: show.id } });
        return {
            showId: show.id,
            title: show.title,
            ...info,
        };
    }
}

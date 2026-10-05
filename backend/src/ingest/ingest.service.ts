import { ConflictException, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ChildProcess, execFile, spawn } from "child_process";
import { PrismaService } from "../prisma/prisma.service";
import { ViewLogService } from "../stats/view-log.service";
import { FollowNotifyService } from "../follows/follow-notify.service";
import {
    ensureStreamOutputDir,
    getFfmpegPidFile,
    getHlsPublicPath,
    getRecordingFile,
    sanitizeStreamId,
} from "../streaming/hls-paths";
import { applyIngestProcessPriority, buildIngestFfmpegArgs, rtmpListenPort } from "./ingest-ffmpeg";
import { parseFfmpegProgress, type EncoderHealth } from "../alerts/ffmpeg-progress";
import * as fs from "fs";

@Injectable()
export class IngestService implements OnModuleDestroy {
    private ffmpegByStream = new Map<string, ChildProcess>();
    private encoderHealth = new Map<string, EncoderHealth>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly views: ViewLogService,
        private readonly followNotify: FollowNotifyService,
    ) {}

    onModuleDestroy() {
        for (const id of [...this.ffmpegByStream.keys()]) {
            void this.stopIngest(id);
        }
    }

    listActiveStreamIds() {
        return [...this.ffmpegByStream.entries()]
            .filter(([, child]) => this.processAlive(child))
            .map(([id]) => id);
    }

    getEncoderHealth(streamId: string): EncoderHealth | null {
        return this.encoderHealth.get(sanitizeStreamId(streamId)) || null;
    }

    async startIngest(streamId: string, _rtpPort?: number) {
        const safeStreamId = sanitizeStreamId(streamId);

        if (this.ffmpegByStream.has(safeStreamId) && this.processAlive(this.ffmpegByStream.get(safeStreamId))) {
            throw new ConflictException("Ehhez a streamhez már fut az ingest.");
        }
        this.ffmpegByStream.delete(safeStreamId);
        await this.killPidFile(safeStreamId);

        const outDir = ensureStreamOutputDir(safeStreamId);
        const recordingFile = getRecordingFile(safeStreamId);
        const rtmpPort = rtmpListenPort();

        const ffmpeg = spawn(
            "ffmpeg",
            buildIngestFfmpegArgs({
                streamId: safeStreamId,
                playlistFile: "index.m3u8",
                recordingFile: "recording.mp4",
            }),
            { cwd: outDir, windowsHide: true },
        );
        applyIngestProcessPriority(ffmpeg);

        this.ffmpegByStream.set(safeStreamId, ffmpeg);
        this.writePidFile(safeStreamId, ffmpeg.pid);

        ffmpeg.stderr.on("data", (data) => {
            const text = String(data);
            console.log(`FFmpeg ingest: ${text}`);
            const parsed = parseFfmpegProgress(text);
            const prev = this.encoderHealth.get(safeStreamId) || { updatedAt: Date.now() };
            this.encoderHealth.set(safeStreamId, {
                ...prev,
                ...parsed,
                dropped: parsed.dropped ?? prev.dropped,
                fps: parsed.fps ?? prev.fps,
                bitrateKbps: parsed.bitrateKbps ?? prev.bitrateKbps,
                speed: parsed.speed ?? prev.speed,
                stall: parsed.stall || prev.stall,
                updatedAt: Date.now(),
            });
        });

        ffmpeg.on("close", () => {
            if (this.ffmpegByStream.get(safeStreamId) !== ffmpeg) return;
            this.ffmpegByStream.delete(safeStreamId);
            this.encoderHealth.delete(safeStreamId);
            this.clearPidFile(safeStreamId);
            void this.markNotLive(safeStreamId);
        });

        ffmpeg.on("error", (err) => {
            console.error("FFmpeg ingest error:", err.message);
            void this.logStartError(safeStreamId, err.message || "FFmpeg ingest error");
            if (this.ffmpegByStream.get(safeStreamId) !== ffmpeg) return;
            this.ffmpegByStream.delete(safeStreamId);
            this.encoderHealth.delete(safeStreamId);
            this.clearPidFile(safeStreamId);
            void this.markNotLive(safeStreamId);
        });

        if (this.ffmpegByStream.get(safeStreamId) !== ffmpeg) {
            void this.logStartError(safeStreamId, "Az ingest a folyamat indítása közben megszakadt.");
            return {
                status: "ingest_aborted",
                streamId: safeStreamId,
                rtpPort: rtmpPort,
                hls: getHlsPublicPath(safeStreamId),
                recording: recordingFile,
                streamDbId: null,
                showId: null,
            };
        }

        const show = await this.prisma.show.findFirst({
            where: { OR: [{ streamId: safeStreamId }, { streamId }] },
        });

        const streamRow = await this.prisma.stream.upsert({
            where: { streamKey: safeStreamId },
            create: {
                title: show?.title || safeStreamId,
                streamKey: safeStreamId,
                showId: show?.id,
                isLive: true,
                hlsPath: getHlsPublicPath(safeStreamId),
                rtpPort: rtmpPort,
            },
            update: {
                isLive: true,
                hlsPath: getHlsPublicPath(safeStreamId),
                rtpPort: rtmpPort,
                showId: show?.id || undefined,
            },
        });
        await this.prisma.$executeRaw`
            UPDATE "Stream" SET "liveStartedAt" = NOW() WHERE "streamKey" = ${safeStreamId}
        `.catch(() => undefined);

        if (show && this.ffmpegByStream.get(safeStreamId) === ffmpeg) {
            await this.prisma.show.update({
                where: { id: show.id },
                data: { live: true, streamId: safeStreamId },
            });
            void this.followNotify.notifyGoingLive(show.id).catch(() => undefined);
        }

        return {
            status: "ingest_started",
            streamId: safeStreamId,
            rtpPort: rtmpPort,
            hls: getHlsPublicPath(safeStreamId),
            recording: recordingFile,
            streamDbId: streamRow.id,
            showId: show?.id || null,
        };
    }

    async stopIngest(streamId: string) {
        const safeStreamId = sanitizeStreamId(streamId);
        const child = this.ffmpegByStream.get(safeStreamId);
        this.ffmpegByStream.delete(safeStreamId);
        this.encoderHealth.delete(safeStreamId);
        await this.markNotLive(safeStreamId);

        if (child) {
            await this.killChild(child);
        }
        await this.killPidFile(safeStreamId);
        this.clearPidFile(safeStreamId);

        const recording = getRecordingFile(safeStreamId);
        const recordingSize = fs.existsSync(recording) ? fs.statSync(recording).size : 0;

        return {
            status: "ingest_stopped",
            streamId: safeStreamId,
            recording,
            recordingBytes: recordingSize,
        };
    }

    private async markNotLive(streamId: string) {
        const safeStreamId = sanitizeStreamId(streamId);
        const shows = await this.prisma.show.findMany({
            where: { OR: [{ streamId: safeStreamId }, { streamId }] },
            select: { id: true },
        });
        if (shows.length) {
            await this.prisma.show.updateMany({
                where: { id: { in: shows.map((s) => s.id) } },
                data: { live: false },
            });
        }
        await this.prisma.stream.updateMany({
            where: { streamKey: safeStreamId },
            data: { isLive: false },
        });
        this.views.releaseLive(safeStreamId);
    }

    private logStartError(streamId: string, message: string) {
        void this.prisma.show
            .findFirst({
                where: { streamId },
                select: { id: true },
            })
            .then((show) =>
                this.views.logStreamError({
                    streamId,
                    showId: show?.id,
                    message,
                    source: "ingest",
                }),
            )
            .catch(() => undefined);
    }

    private processAlive(child?: ChildProcess) {
        if (!child?.pid) return false;
        try {
            process.kill(child.pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    private writePidFile(streamId: string, pid?: number) {
        if (!pid) return;
        try {
            fs.writeFileSync(getFfmpegPidFile(streamId), String(pid), "utf8");
        } catch {
            /* ignore */
        }
    }

    private clearPidFile(streamId: string) {
        try {
            const file = getFfmpegPidFile(streamId);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch {
            /* ignore */
        }
    }

    private async killPidFile(streamId: string) {
        const file = getFfmpegPidFile(streamId);
        if (!fs.existsSync(file)) return;
        const pid = Number(fs.readFileSync(file, "utf8").trim());
        if (!Number.isInteger(pid) || pid <= 0) return;
        await this.killPid(pid);
    }

    private killChild(child: ChildProcess) {
        return new Promise<void>((resolve) => {
            const done = () => resolve();
            const killTimer = setTimeout(() => {
                void this.killPid(child.pid);
                done();
            }, 4_000);
            child.once("close", () => {
                clearTimeout(killTimer);
                done();
            });
            try {
                if (child.stdin && !child.stdin.destroyed) {
                    child.stdin.write("q");
                }
            } catch {
                /* ignore */
            }
            void this.killPid(child.pid);
        });
    }

    private killPid(pid?: number) {
        if (!pid) return Promise.resolve();
        return new Promise<void>((resolve) => {
            if (process.platform === "win32") {
                execFile("taskkill", ["/PID", String(pid), "/T", "/F"], () => resolve());
                return;
            }
            try {
                process.kill(pid, "SIGTERM");
            } catch {
                /* already gone */
            }
            setTimeout(() => {
                try {
                    process.kill(pid, "SIGKILL");
                } catch {
                    /* ignore */
                }
                resolve();
            }, 500);
        });
    }
}

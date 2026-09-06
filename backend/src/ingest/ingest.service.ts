import { ConflictException, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ChildProcess, execFile, spawn } from "child_process";
import { PrismaService } from "../prisma/prisma.service";
import { LiveViewTracker } from "../stats/live-view-tracker";
import { FollowNotifyService } from "../follows/follow-notify.service";
import {
    ensureStreamOutputDir,
    getFfmpegPidFile,
    getHlsPlaylistFile,
    getHlsPublicPath,
    getRecordingFile,
    sanitizeStreamId,
} from "../streaming/hls-paths";
import * as fs from "fs";

@Injectable()
export class IngestService implements OnModuleDestroy {
    private ffmpegByStream = new Map<string, ChildProcess>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly liveViews: LiveViewTracker,
        private readonly followNotify: FollowNotifyService,
    ) {}

    onModuleDestroy() {
        for (const id of [...this.ffmpegByStream.keys()]) {
            void this.stopIngest(id);
        }
    }

    async startIngest(streamId: string, rtpPort: number) {
        const safeStreamId = sanitizeStreamId(streamId);

        if (this.ffmpegByStream.has(safeStreamId) && this.processAlive(this.ffmpegByStream.get(safeStreamId))) {
            throw new ConflictException("Ehhez a streamhez már fut az ingest.");
        }
        this.ffmpegByStream.delete(safeStreamId);
        await this.killPidFile(safeStreamId);

        ensureStreamOutputDir(safeStreamId);
        const hlsFile = getHlsPlaylistFile(safeStreamId);
        const recordingFile = getRecordingFile(safeStreamId);

        const ffmpeg = spawn("ffmpeg", [
            "-hide_banner",
            "-loglevel",
            "warning",
            "-i",
            `udp://0.0.0.0:${rtpPort}`,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-tune",
            "zerolatency",
            "-c:a",
            "aac",
            "-f",
            "hls",
            "-hls_time",
            "2",
            "-hls_list_size",
            "6",
            "-hls_flags",
            "delete_segments",
            hlsFile,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-c:a",
            "aac",
            "-f",
            "mp4",
            "-movflags",
            "+frag_keyframe+empty_moov+default_base_moof",
            recordingFile,
        ]);

        this.ffmpegByStream.set(safeStreamId, ffmpeg);
        this.writePidFile(safeStreamId, ffmpeg.pid);

        ffmpeg.stderr.on("data", (data) => {
            console.log(`FFmpeg ingest: ${data}`);
        });

        ffmpeg.on("close", () => {
            if (this.ffmpegByStream.get(safeStreamId) !== ffmpeg) return;
            this.ffmpegByStream.delete(safeStreamId);
            this.clearPidFile(safeStreamId);
            void this.markNotLive(safeStreamId);
        });

        ffmpeg.on("error", (err) => {
            console.error("FFmpeg ingest error:", err.message);
            if (this.ffmpegByStream.get(safeStreamId) !== ffmpeg) return;
            this.ffmpegByStream.delete(safeStreamId);
            this.clearPidFile(safeStreamId);
            void this.markNotLive(safeStreamId);
        });

        if (this.ffmpegByStream.get(safeStreamId) !== ffmpeg) {
            return {
                status: "ingest_aborted",
                streamId: safeStreamId,
                rtpPort,
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
                rtpPort,
            },
            update: {
                isLive: true,
                hlsPath: getHlsPublicPath(safeStreamId),
                rtpPort,
                showId: show?.id || undefined,
            },
        });

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
            rtpPort,
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
        for (const show of shows) {
            this.liveViews.clearStream(safeStreamId, show.id);
        }
        this.liveViews.clearStream(safeStreamId);
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

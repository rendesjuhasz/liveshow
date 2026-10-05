import {
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fsp } from "fs";
import * as path from "path";
import {
    ensureStreamOutputDir,
    getArchiveFile,
    getArchivePublicPath,
    getHlsPlaylistFile,
    getRecordingFile,
    getRecordingPublicPath,
} from "./hls-paths";
import { fileSize, fileStat, pathExists } from "./fs-async";

const execAsync = promisify(exec);

@Injectable()
export class FfmpegPipeline {
    async generateArchive(streamId: string): Promise<string> {
        ensureStreamOutputDir(streamId);

        const recording = getRecordingFile(streamId);
        const playlist = getHlsPlaylistFile(streamId);
        const output = getArchiveFile(streamId);

        const recSize = await fileSize(recording);
        const hasRecording = recSize >= 1024;
        const hasPlaylist = await pathExists(playlist);
        let playlistHasSegments = false;
        if (hasPlaylist) {
            const text = await fsp.readFile(playlist, "utf8");
            const names = text
                .split("\n")
                .map((line) => line.trim())
                .filter((name) => name && !name.startsWith("#"));
            for (const name of names) {
                if (await pathExists(path.join(path.dirname(playlist), path.basename(name)))) {
                    playlistHasSegments = true;
                    break;
                }
            }
        }

        if (!hasRecording && !playlistHasSegments) {
            throw new NotFoundException(
                "Nincs rögzített videó. Archívum csak akkor készül, ha az adás alatt tényleges kép/hang érkezik (például OBS).",
            );
        }

        const input = hasRecording ? recording : playlist;
        const extra = hasRecording ? "" : "-allowed_extensions ALL ";

        try {
            await execAsync(
                `ffmpeg -y ${extra}-i "${input}" -c copy "${output}"`,
            );
        } catch {
            await execAsync(
                `ffmpeg -y ${extra}-i "${input}" -c:v libx264 -preset veryfast -c:a aac "${output}"`,
            );
        }

        if (!(await pathExists(output))) {
            throw new NotFoundException("Az FFmpeg nem hozta létre az archívumot.");
        }

        return output;
    }

    async ingestUploadedVideo(streamId: string, sourcePath: string) {
        ensureStreamOutputDir(streamId);
        const output = getArchiveFile(streamId);
        const ext = path.extname(sourcePath).toLowerCase();
        const opts = { timeout: 30 * 60_000, maxBuffer: 32 * 1024 * 1024 };
        const copyFirst = ext === ".mp4" || ext === ".m4v";
        if (copyFirst) {
            try {
                await execAsync(
                    `ffmpeg -y -i "${sourcePath}" -c copy -movflags +faststart "${output}"`,
                    opts,
                );
            } catch {
                /* transcode below */
            }
        }
        if ((await fileSize(output)) < 1024) {
            await execAsync(
                `ffmpeg -y -i "${sourcePath}" -c:v libx264 -preset veryfast -c:a aac -movflags +faststart "${output}"`,
                opts,
            );
        }
        if ((await fileSize(output)) < 1024) {
            throw new NotFoundException("A videó feldolgozása nem sikerült. Próbáld MP4 formátumban.");
        }
        return output;
    }

    async probeDurationSeconds(filePath: string): Promise<number> {
        if (!filePath) return 0;
        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "${filePath}"`,
            );
            const n = Number(String(stdout || "").trim());
            return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
        } catch {
            return 0;
        }
    }

    async getArchiveInfo(streamId: string) {
        const archivePath = getArchiveFile(streamId);
        const archiveStat = await fileStat(archivePath);
        if (archiveStat && archiveStat.size >= 1024) {
            return {
                exists: true,
                streamId,
                filePath: archivePath,
                publicPath: getArchivePublicPath(streamId),
                size: archiveStat.size,
                createdAt: archiveStat.mtime.toISOString(),
            };
        }

        const recordingPath = getRecordingFile(streamId);
        const recordingStat = await fileStat(recordingPath);
        if (recordingStat && recordingStat.size >= 1024) {
            return {
                exists: true,
                streamId,
                filePath: recordingPath,
                publicPath: getRecordingPublicPath(streamId),
                size: recordingStat.size,
                createdAt: recordingStat.mtime.toISOString(),
            };
        }

        return {
            exists: false,
            streamId,
            filePath: null,
            publicPath: getArchivePublicPath(streamId),
            size: 0,
            createdAt: null,
        };
    }

    async deleteArchive(streamId: string) {
        const filePath = getArchiveFile(streamId);
        if (await pathExists(filePath)) {
            await fsp.unlink(filePath);
        }
        return this.getArchiveInfo(streamId);
    }

    getLivePlaylistPath(streamId: string) {
        ensureStreamOutputDir(streamId);
        return getHlsPlaylistFile(streamId);
    }
}

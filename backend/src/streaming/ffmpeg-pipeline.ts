import {
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import {
    ensureStreamOutputDir,
    getArchiveFile,
    getArchivePublicPath,
    getHlsPlaylistFile,
    getRecordingFile,
    getRecordingPublicPath,
} from "./hls-paths";

const execAsync = promisify(exec);

@Injectable()
export class FfmpegPipeline {
    async generateArchive(streamId: string): Promise<string> {
        ensureStreamOutputDir(streamId);

        const recording = getRecordingFile(streamId);
        const playlist = getHlsPlaylistFile(streamId);
        const output = getArchiveFile(streamId);

        const hasRecording = fs.existsSync(recording) && fs.statSync(recording).size >= 1024;
        const hasPlaylist = fs.existsSync(playlist);
        const playlistHasSegments =
            hasPlaylist &&
            fs
                .readFileSync(playlist, "utf8")
                .split("\n")
                .some((line) => {
                    const name = line.trim();
                    return (
                        name &&
                        !name.startsWith("#") &&
                        fs.existsSync(path.join(path.dirname(playlist), path.basename(name)))
                    );
                });

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

        if (!fs.existsSync(output)) {
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
        if (!fs.existsSync(output) || fs.statSync(output).size < 1024) {
            await execAsync(
                `ffmpeg -y -i "${sourcePath}" -c:v libx264 -preset veryfast -c:a aac -movflags +faststart "${output}"`,
                opts,
            );
        }
        if (!fs.existsSync(output) || fs.statSync(output).size < 1024) {
            throw new NotFoundException("A videó feldolgozása nem sikerült. Próbáld MP4 formátumban.");
        }
        return output;
    }

    getArchiveInfo(streamId: string) {
        const archivePath = getArchiveFile(streamId);
        if (fs.existsSync(archivePath) && fs.statSync(archivePath).size >= 1024) {
            const stat = fs.statSync(archivePath);
            return {
                exists: true,
                streamId,
                filePath: archivePath,
                publicPath: getArchivePublicPath(streamId),
                size: stat.size,
                createdAt: stat.mtime.toISOString(),
            };
        }

        const recordingPath = getRecordingFile(streamId);
        if (fs.existsSync(recordingPath) && fs.statSync(recordingPath).size >= 1024) {
            const stat = fs.statSync(recordingPath);
            return {
                exists: true,
                streamId,
                filePath: recordingPath,
                publicPath: getRecordingPublicPath(streamId),
                size: stat.size,
                createdAt: stat.mtime.toISOString(),
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

    deleteArchive(streamId: string) {
        const filePath = getArchiveFile(streamId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return this.getArchiveInfo(streamId);
    }

    getLivePlaylistPath(streamId: string) {
        ensureStreamOutputDir(streamId);
        return getHlsPlaylistFile(streamId);
    }
}

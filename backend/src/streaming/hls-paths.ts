import * as fs from "fs";
import * as path from "path";

export const HLS_OUTPUT_ROOT = path.join(process.cwd(), "output");

export function sanitizeStreamId(streamId: string) {
    return streamId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getStreamOutputDir(streamId: string) {
    return path.join(HLS_OUTPUT_ROOT, sanitizeStreamId(streamId));
}

export function ensureStreamOutputDir(streamId: string) {
    const dir = getStreamOutputDir(streamId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function getHlsPlaylistFile(streamId: string) {
    return path.join(getStreamOutputDir(streamId), "index.m3u8");
}

export function getHlsSegmentFile(streamId: string, segment: string) {
    const safeSegment = path.basename(segment);
    return path.join(getStreamOutputDir(streamId), safeSegment);
}

export function getHlsPublicPath(streamId: string) {
    return `/output/${sanitizeStreamId(streamId)}/index.m3u8`;
}

export function getArchiveFile(streamId: string) {
    return path.join(getStreamOutputDir(streamId), "archive.mp4");
}

export function getArchivePublicPath(streamId: string) {
    return `/output/${sanitizeStreamId(streamId)}/archive.mp4`;
}

export function getPreviewFile(streamId: string) {
    return path.join(getStreamOutputDir(streamId), "preview.mp4");
}

export function getPreviewPublicPath(streamId: string) {
    return `/output/${sanitizeStreamId(streamId)}/preview.mp4`;
}

export function getRecordingFile(streamId: string) {
    return path.join(getStreamOutputDir(streamId), "recording.mp4");
}

export function getRecordingPublicPath(streamId: string) {
    return `/output/${sanitizeStreamId(streamId)}/recording.mp4`;
}

export function getFfmpegPidFile(streamId: string) {
    return path.join(getStreamOutputDir(streamId), "ffmpeg.pid");
}

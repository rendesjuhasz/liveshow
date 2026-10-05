import * as os from "os";
import type { ChildProcess } from "child_process";

/** 720p30 production ingest. One x264 encode; HLS + recording share the bitstream via tee. */
export const INGEST_VIDEO_MAXRATE = "2500k";
export const INGEST_VIDEO_BUFSIZE = "5000k";
export const INGEST_VIDEO_BITRATE = "2000k";
export const INGEST_THREADS = "2";
export const INGEST_SCALE = "1280:720";
export const INGEST_FPS = "30";

export function ingestEncodeAndTeeArgs(playlistFile: string, recordingFile: string) {
    const playlist = teePath(playlistFile);
    const recording = teePath(recordingFile);
    const tee =
        `[f=hls:hls_time=2:hls_list_size=6:hls_flags=delete_segments]${playlist}` +
        `|[f=mp4:movflags=+frag_keyframe+empty_moov+default_base_moof]${recording}`;

    return [
        "-filter:v",
        `scale=${INGEST_SCALE}:force_original_aspect_ratio=decrease,pad=${INGEST_SCALE}:(ow-iw)/2:(oh-ih)/2,fps=${INGEST_FPS},format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-tune",
        "zerolatency",
        "-b:v",
        INGEST_VIDEO_BITRATE,
        "-maxrate",
        INGEST_VIDEO_MAXRATE,
        "-bufsize",
        INGEST_VIDEO_BUFSIZE,
        "-g",
        "60",
        "-keyint_min",
        "60",
        "-sc_threshold",
        "0",
        "-x264-params",
        "threads=2:sliced-threads=1",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-flags",
        "+global_header",
        "-f",
        "tee",
        tee,
    ];
}

export function rtmpListenPort() {
    const n = Number(process.env.RTMP_PORT);
    return Number.isInteger(n) && n > 0 ? n : 1935;
}

export function rtmpAppName() {
    return "live";
}

export function rtmpPullUrl(streamId: string) {
    return `rtmp://127.0.0.1:${rtmpListenPort()}/${rtmpAppName()}/${streamId}`;
}

export function buildIngestFfmpegArgs(opts: { streamId: string; playlistFile: string; recordingFile: string }) {
    return [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-threads",
        INGEST_THREADS,
        "-rw_timeout",
        "5000000",
        "-i",
        rtmpPullUrl(opts.streamId),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        ...ingestEncodeAndTeeArgs(opts.playlistFile, opts.recordingFile),
    ];
}

/** FFmpeg tee uses `:` as option separator; escape Windows drive letters and keep forward slashes. */
export function teePath(filePath: string) {
    return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export function countLibx264(args: string[]) {
    return args.filter((a) => a === "libx264").length;
}

/** Lower FFmpeg scheduling priority so Nest and Nginx keep CPU under load. */
export function applyIngestProcessPriority(child: ChildProcess) {
    const pid = child.pid;
    if (!pid) return;
    try {
        os.setPriority(pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch {
        /* Windows/unix: ignore if the child already exited or we lack permission */
    }
}

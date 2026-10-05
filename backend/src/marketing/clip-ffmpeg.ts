import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import {
    ensureStreamOutputDir,
    getArchiveFile,
    getRecordingFile,
    getStreamOutputDir,
    sanitizeStreamId,
} from "../streaming/hls-paths";

const execFileAsync = promisify(execFile);

function clipsDir(streamId: string) {
    const dir = path.join(ensureStreamOutputDir(streamId), "clips");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function sourceFile(streamId: string) {
    const rec = getRecordingFile(streamId);
    if (fs.existsSync(rec) && fs.statSync(rec).size >= 1024) return rec;
    const arch = getArchiveFile(streamId);
    if (fs.existsSync(arch) && fs.statSync(arch).size >= 1024) return arch;
    return "";
}

export function clipPublicPath(streamId: string, fileName: string) {
    return `/output/${sanitizeStreamId(streamId)}/clips/${path.basename(fileName)}`;
}

export async function cutMarketingClip(input: {
    streamId: string;
    clipId: string;
    offsetSec: number;
    durationSec: number;
}) {
    const src = sourceFile(input.streamId);
    if (!src) throw new Error("Nincs felvétel a kliphez.");
    const dir = clipsDir(input.streamId);
    const wideName = `${input.clipId}.mp4`;
    const vertName = `${input.clipId}-v.mp4`;
    const wide = path.join(dir, wideName);
    const vertical = path.join(dir, vertName);
    const start = Math.max(0, input.offsetSec);
    const dur = Math.max(5, input.durationSec);
    const opts = { timeout: 5 * 60_000, maxBuffer: 8 * 1024 * 1024 };
    await execFileAsync(
        "ffmpeg",
        ["-y", "-ss", String(start), "-t", String(dur), "-i", src, "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", wide],
        opts,
    );
    if (!fs.existsSync(wide) || fs.statSync(wide).size < 512) {
        throw new Error("A klip nem készült el.");
    }
    try {
        await execFileAsync(
            "ffmpeg",
            [
                "-y",
                "-i",
                wide,
                "-vf",
                "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                vertical,
            ],
            opts,
        );
    } catch {
        /* 9:16 optional if encode fails */
    }
    return {
        filePath: wide,
        verticalPath: fs.existsSync(vertical) ? vertical : null,
        publicPath: clipPublicPath(input.streamId, wideName),
    };
}

export function assertClipUnderOutput(filePath: string) {
    const root = path.resolve(getStreamOutputDir("_"));
    const clipsRoot = path.resolve(path.dirname(root));
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(clipsRoot)) {
        throw new Error("Érvénytelen klip útvonal.");
    }
}

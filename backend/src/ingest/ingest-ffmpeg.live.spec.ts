import { spawn } from "child_process";
import * as fs from "fs";
import { applyIngestProcessPriority, ingestEncodeAndTeeArgs, INGEST_THREADS } from "./ingest-ffmpeg";
import { FfmpegPipeline } from "../streaming/ffmpeg-pipeline";
import { ensureStreamOutputDir, getArchiveFile, getHlsPlaylistFile, getRecordingFile } from "../streaming/hls-paths";

function ffmpegAvailable() {
    return new Promise<boolean>((resolve) => {
        const child = spawn("ffmpeg", ["-version"]);
        child.on("error", () => resolve(false));
        child.on("close", (code) => resolve(code === 0));
    });
}

function run(args: string[], timeoutMs: number, cwd: string) {
    return new Promise<{ code: number; stderr: string }>((resolve, reject) => {
        const child = spawn("ffmpeg", args, { windowsHide: true, cwd });
        applyIngestProcessPriority(child);
        let stderr = "";
        child.stderr.on("data", (d) => {
            stderr += d.toString();
        });
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`ffmpeg timeout\n${stderr.slice(-2000)}`));
        }, timeoutMs);
        child.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ code: code ?? 1, stderr });
        });
    });
}

describe("P0 ingest pipeline (ffmpeg)", () => {
    jest.setTimeout(45_000);

    it("writes HLS, recording, and archive from a 720p-capped tee encode", async () => {
        if (!(await ffmpegAvailable())) {
            console.warn("ffmpeg not on PATH — skipped live encode/archive smoke test");
            return;
        }

        const streamId = `p0_${Date.now()}`;
        const dir = ensureStreamOutputDir(streamId);
        const playlist = "index.m3u8";
        const recording = "recording.mp4";

        const args = [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-threads",
            INGEST_THREADS,
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=1920x1080:rate=30:duration=6",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000:duration=6",
            "-shortest",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            ...ingestEncodeAndTeeArgs(playlist, recording),
        ];

        const result = await run(args, 40_000, dir);
        expect(result.code).toBe(0);
        expect(fs.existsSync(getHlsPlaylistFile(streamId))).toBe(true);
        expect(fs.readFileSync(getHlsPlaylistFile(streamId), "utf8")).toMatch(/#EXTM3U/);
        expect(fs.statSync(getRecordingFile(streamId)).size).toBeGreaterThan(1024);

        const pipeline = new FfmpegPipeline();
        const archivePath = await pipeline.generateArchive(streamId);
        expect(archivePath).toBe(getArchiveFile(streamId));
        expect(fs.statSync(archivePath).size).toBeGreaterThan(1024);

        fs.rmSync(dir, { recursive: true, force: true });
    });
});

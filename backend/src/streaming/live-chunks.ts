import { promises as fsp } from "fs";
import * as fs from "fs";
import * as path from "path";
import { getStreamOutputDir } from "./hls-paths";
import { pathExists } from "./fs-async";

export const LIVE_CHUNKS_DIR = "live-chunks";
export const MAX_LIVE_CHUNK_INDEX = 20_000;

export function liveChunkFileName(index: number) {
    return `${String(index).padStart(6, "0")}.part`;
}

export function getLiveChunksDir(streamId: string) {
    return path.join(getStreamOutputDir(streamId), LIVE_CHUNKS_DIR);
}

export function getLiveChunkPath(streamId: string, index: number) {
    return path.join(getLiveChunksDir(streamId), liveChunkFileName(index));
}

export function getLiveConcatFile(streamId: string) {
    return path.join(getStreamOutputDir(streamId), "live-concat.webm");
}

export async function listLiveChunkPaths(streamId: string): Promise<string[]> {
    const dir = getLiveChunksDir(streamId);
    if (!(await pathExists(dir))) return [];
    const names = await fsp.readdir(dir);
    return names
        .filter((name) => /^\d{6}\.part$/.test(name))
        .sort()
        .map((name) => path.join(dir, name));
}

export async function resetLiveChunks(streamId: string) {
    const dir = getLiveChunksDir(streamId);
    await fsp.rm(dir, { recursive: true, force: true });
    await fsp.mkdir(dir, { recursive: true });
}

export async function ensureLiveChunksDir(streamId: string) {
    await fsp.mkdir(getLiveChunksDir(streamId), { recursive: true });
}

export async function concatLiveChunkFiles(files: string[], dest: string) {
    if (!files.length) {
        throw new Error("Nincs rögzített darab.");
    }
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.rm(dest, { force: true });
    await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(dest);
        out.on("error", reject);
        const writeNext = (i: number) => {
            if (i >= files.length) {
                out.end(() => resolve());
                return;
            }
            const inp = fs.createReadStream(files[i]);
            inp.on("error", reject);
            inp.on("end", () => writeNext(i + 1));
            inp.pipe(out, { end: false });
        };
        writeNext(0);
    });
    if (!(await pathExists(dest))) {
        throw new Error("A összerakott felvétel üres.");
    }
}

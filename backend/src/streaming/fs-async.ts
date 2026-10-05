import { promises as fsp } from "fs";

export async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fsp.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function fileStat(filePath: string) {
    try {
        return await fsp.stat(filePath);
    } catch {
        return null;
    }
}

export async function fileSize(filePath: string): Promise<number> {
    const st = await fileStat(filePath);
    return st?.size || 0;
}

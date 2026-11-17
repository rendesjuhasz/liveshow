/** HLS fragments stay out of snapshots. Large recordings must not copy on the API thread. */
export const SKIP_MEDIA_EXT = new Set([
    ".ts",
    ".m3u8",
    ".tmp",
    ".part",
    ".mp4",
    ".m4v",
    ".webm",
    ".mov",
    ".mkv",
]);

export function backupMediaEnabled() {
    const raw = String(process.env.BACKUP_MEDIA || "false").toLowerCase();
    return raw === "true" || raw === "1" || raw === "on";
}

export function shouldSkipBackupFile(name: string) {
    const raw = String(name || "");
    const i = raw.lastIndexOf(".");
    if (i < 0) return false;
    return SKIP_MEDIA_EXT.has(raw.slice(i).toLowerCase());
}

export function backupStartupDelayMs() {
    const ms = Number(process.env.BACKUP_STARTUP_DELAY_MS || 3_600_000);
    return Number.isFinite(ms) && ms >= 0 ? ms : 3_600_000;
}

export function recentBackupIsFresh(finishedAt: string | null | undefined, intervalMs: number) {
    if (!finishedAt) return false;
    const t = Date.parse(finishedAt);
    if (!Number.isFinite(t)) return false;
    const windowMs = Math.max(60_000, intervalMs * 0.9);
    return Date.now() - t < windowMs;
}

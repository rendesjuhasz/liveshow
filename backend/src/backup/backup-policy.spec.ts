import {
    backupMediaEnabled,
    backupStartupDelayMs,
    recentBackupIsFresh,
    shouldSkipBackupFile,
} from "./backup-policy";

describe("backup-policy", () => {
    const prevMedia = process.env.BACKUP_MEDIA;
    const prevDelay = process.env.BACKUP_STARTUP_DELAY_MS;

    afterEach(() => {
        if (prevMedia === undefined) delete process.env.BACKUP_MEDIA;
        else process.env.BACKUP_MEDIA = prevMedia;
        if (prevDelay === undefined) delete process.env.BACKUP_STARTUP_DELAY_MS;
        else process.env.BACKUP_STARTUP_DELAY_MS = prevDelay;
    });

    it("skips recordings and HLS fragments", () => {
        expect(shouldSkipBackupFile("recording.mp4")).toBe(true);
        expect(shouldSkipBackupFile("clip.webm")).toBe(true);
        expect(shouldSkipBackupFile("seg.ts")).toBe(true);
        expect(shouldSkipBackupFile("index.m3u8")).toBe(true);
        expect(shouldSkipBackupFile("avatar.webp")).toBe(false);
        expect(shouldSkipBackupFile("notes")).toBe(false);
    });

    it("keeps media copy off unless BACKUP_MEDIA is on", () => {
        delete process.env.BACKUP_MEDIA;
        expect(backupMediaEnabled()).toBe(false);
        process.env.BACKUP_MEDIA = "true";
        expect(backupMediaEnabled()).toBe(true);
    });

    it("defaults first automatic run to one hour", () => {
        delete process.env.BACKUP_STARTUP_DELAY_MS;
        expect(backupStartupDelayMs()).toBe(3_600_000);
    });

    it("treats a successful backup inside the interval as fresh", () => {
        expect(recentBackupIsFresh(new Date().toISOString(), 24 * 3600_000)).toBe(true);
        expect(recentBackupIsFresh(new Date(Date.now() - 23 * 3600_000).toISOString(), 24 * 3600_000)).toBe(false);
    });
});

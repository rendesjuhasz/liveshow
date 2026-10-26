export function autoPosterFileName(showId: string) {
    return `poster-${showId}.jpg`;
}

export function autoPosterStoredPath(showId: string) {
    return `/uploads/covers/${autoPosterFileName(showId)}`;
}

export function isAutoPosterPath(image: string | null | undefined, showId: string) {
    const raw = String(image || "").split("?")[0].trim();
    return raw === autoPosterStoredPath(showId);
}

export function shouldReplaceShowImage(image: string | null | undefined, showId: string) {
    const raw = String(image || "").split("?")[0].trim();
    if (!raw) return true;
    return isAutoPosterPath(raw, showId);
}

/** Prefer a mid-intro frame, not the first (often black) or last. */
export function posterSeekSeconds(durationSec: number) {
    const duration = Number(durationSec) || 0;
    if (duration <= 1) return 0;
    const at = Math.min(duration * 0.15, 8);
    return Math.max(0.5, Math.min(at, duration - 0.25));
}

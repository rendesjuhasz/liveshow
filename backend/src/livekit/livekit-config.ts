export type LiveVideoBackend = "mesh" | "livekit";

function env(name: string) {
    return String(process.env[name] || "").trim();
}

export function livekitApiKey() {
    return env("LIVEKIT_API_KEY");
}

export function livekitApiSecret() {
    return env("LIVEKIT_API_SECRET");
}

/** Browser / client websocket URL (wss://live.example.com). */
export function livekitPublicUrl() {
    return env("LIVEKIT_PUBLIC_URL") || env("LIVEKIT_URL");
}

export function livekitTokenTtlSec() {
    const n = Number(env("LIVEKIT_TOKEN_TTL_SEC") || "3600");
    if (!Number.isFinite(n) || n < 60) return 3600;
    return Math.min(Math.trunc(n), 24 * 3600);
}

/** HTTP URL for server-side health probes (not the browser wss URL). */
export function livekitHttpUrl() {
    const u = env("LIVEKIT_URL");
    if (u.startsWith("http://") || u.startsWith("https://")) return u.replace(/\/$/, "");
    return "http://127.0.0.1:7880";
}

/** Reconnect ~80% of JWT TTL (min 15s). */
export function tokenRefreshDelayMs(expiresIn: number) {
    const ttlSec = Math.max(60, Math.floor(Number(expiresIn) || 3600));
    return Math.max(15_000, Math.floor(ttlSec * 0.8) * 1000);
}

export function livekitKeysConfigured() {
    return Boolean(livekitApiKey() && livekitApiSecret() && livekitPublicUrl());
}

/** Explicit flag. Empty → livekit if keys exist, otherwise mesh. */
export function liveVideoBackendDefault(): LiveVideoBackend {
    const v = env("LIVE_VIDEO_BACKEND").toLowerCase();
    if (v === "livekit") return "livekit";
    if (v === "mesh") return "mesh";
    return livekitKeysConfigured() ? "livekit" : "mesh";
}

/** If set, only these show UUIDs use LiveKit; every other show stays on mesh. */
export function livekitShowAllowlist() {
    return env("LIVEKIT_SHOW_IDS")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

export function usesLivekitForShow(showId: string) {
    const id = String(showId || "").trim();
    if (!id || !livekitKeysConfigured()) return false;
    const list = livekitShowAllowlist();
    if (list.length) return list.includes(id);
    return liveVideoBackendDefault() === "livekit";
}

export function livekitRoomName(showId: string) {
    return `show:${String(showId || "").trim()}`;
}

export function parseLiveVideoBackend(value: unknown): LiveVideoBackend | null {
    return value === "livekit" || value === "mesh" ? value : null;
}

export function plannedLiveVideoBackend(showId: string): LiveVideoBackend {
    return usesLivekitForShow(showId) ? "livekit" : "mesh";
}

/** First mesh|livekit wins; later values cannot switch the live path. */
export function lockLiveVideoBackend(
    current: LiveVideoBackend | null | undefined,
    incoming: LiveVideoBackend | null | undefined,
): LiveVideoBackend | null {
    if (current === "livekit" || current === "mesh") return current;
    if (incoming === "livekit" || incoming === "mesh") return incoming;
    return null;
}

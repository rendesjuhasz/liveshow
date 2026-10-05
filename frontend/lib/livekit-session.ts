import { apiFetch } from "@/api/http";
import { getViewerKey } from "@/lib/viewer-key";

export type LiveVideoBackend = "mesh" | "livekit";

export type LiveVideoConfig = {
    backend: LiveVideoBackend | null;
    plannedBackend: LiveVideoBackend;
    publisherActive: boolean;
    configured: boolean;
    url?: string;
};

export type LivekitToken = {
    url: string;
    token: string;
    roomName: string;
    role: "publisher" | "viewer";
    showId: string;
    streamId: string;
    identity: string;
    expiresIn: number;
    backend: "livekit";
};

/** First mesh|livekit wins; the viewer path cannot switch mid-stream. */
export function lockLiveVideoBackend(
    current: LiveVideoBackend | null | undefined,
    incoming: LiveVideoBackend | null | undefined,
): LiveVideoBackend | null {
    if (current === "livekit" || current === "mesh") return current;
    if (incoming === "livekit" || incoming === "mesh") return incoming;
    return null;
}

export async function fetchLiveVideoConfig(showId: string): Promise<LiveVideoConfig> {
    const q = new URLSearchParams({ showId });
    const data = await apiFetch(`/livekit/config?${q.toString()}`);
    const planned: LiveVideoBackend = data?.plannedBackend === "livekit" ? "livekit" : "mesh";
    const live =
        data?.backend === "livekit" || data?.backend === "mesh" ? (data.backend as LiveVideoBackend) : null;
    return {
        backend: live,
        plannedBackend: planned,
        publisherActive: Boolean(data?.publisherActive) || live != null,
        configured: Boolean(data?.configured),
        url: String(data?.url || ""),
    };
}

export async function fetchLivekitToken(showId: string, role: "publisher" | "viewer"): Promise<LivekitToken> {
    const body: Record<string, string> = { showId, role };
    if (role === "viewer") {
        body.viewerKey = getViewerKey();
    }
    return apiFetch("/livekit/token", { method: "POST", body: JSON.stringify(body) });
}

/** Reconnect ~80% of JWT TTL so the grant never expires mid-show (min 15s). */
export function tokenRefreshDelayMs(expiresIn: number) {
    const ttlSec = Math.max(60, Math.floor(Number(expiresIn) || 3600));
    return Math.max(15_000, Math.floor(ttlSec * 0.8) * 1000);
}

export function scheduleTokenRefresh(expiresIn: number, onRefresh: () => void) {
    const id = window.setTimeout(onRefresh, tokenRefreshDelayMs(expiresIn));
    return () => window.clearTimeout(id);
}

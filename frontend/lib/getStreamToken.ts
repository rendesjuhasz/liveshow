import { apiFetch } from "@/api/http";
import { getViewerKey } from "@/lib/viewer-key";

export type StreamToken = {
    token?: string;
    expiresAt: number;
    streamId: string;
    userId: string;
    cookie?: boolean;
};

export type SignedHlsUrl = StreamToken & {
    streamId: string;
    url: string;
};

export function isPlaceholderStreamId(value?: string | null) {
    const v = value?.trim() ?? "";
    if (!v) return true;
    return (
        v === "{streamId}" ||
        v === "{id}" ||
        v.includes("{streamId}") ||
        v.includes("%7BstreamId%7D")
    );
}

export function interpolateStreamId(value: string, streamId: string) {
    return value
        .replaceAll("%7BstreamId%7D", encodeURIComponent(streamId))
        .replaceAll("{streamId}", streamId);
}

export async function getStreamToken(
    streamId: string,
    showId?: string,
    purpose: "live" | "archive" | "private" = "live",
): Promise<StreamToken> {
    if (isPlaceholderStreamId(streamId)) {
        throw new Error("Hiányzik a stream ID. Add meg a műsor Stream ID mezőjét.");
    }

    const params = new URLSearchParams({
        streamId,
        purpose,
    });
    if (showId?.trim()) {
        params.set("showId", showId.trim());
    }
    const viewerKey = getViewerKey();
    if (viewerKey) params.set("viewerKey", viewerKey);

    const data = await apiFetch(`/token/generate?${params.toString()}`);
    if (!data?.expiresAt || !data?.userId) {
        throw new Error("Érvénytelen stream token.");
    }

    return {
        expiresAt: Number(data.expiresAt),
        streamId: String(data.streamId || streamId),
        userId: String(data.userId || ""),
        cookie: true,
    };
}

export function sameOriginMediaUrl(url: string) {
    if (typeof window === "undefined") return url;
    try {
        const u = new URL(url, window.location.origin);
        if (u.origin === window.location.origin) return `${u.pathname}${u.search}`;
        if (u.pathname.startsWith("/output/") || u.pathname.startsWith("/stream/")) {
            return `${u.pathname}${u.search}`;
        }
    } catch {
        /* keep */
    }
    return url.replace(/^https?:\/\/[^/]+/, "");
}

export function buildHlsPlaylistUrl(streamId: string) {
    if (isPlaceholderStreamId(streamId)) {
        throw new Error("Hiányzik a stream ID. Add meg a műsor Stream ID mezőjét.");
    }
    return `/output/${encodeURIComponent(streamId)}/index.m3u8`;
}

export function buildArchiveUrl(streamId: string, publicPath?: string | null) {
    if (publicPath?.trim().startsWith("/")) {
        return publicPath.trim();
    }
    if (isPlaceholderStreamId(streamId)) {
        throw new Error("Hiányzik a stream ID. Add meg a műsor Stream ID mezőjét.");
    }
    return `/output/${encodeURIComponent(streamId)}/archive.mp4`;
}

export async function buildSignedArchiveUrl(streamId: string, showId?: string, publicPath?: string | null) {
    const { expiresAt, streamId: signedId, userId } = await getStreamToken(streamId, showId, "archive");
    return {
        streamId: signedId || streamId,
        expiresAt,
        userId,
        url: buildArchiveUrl(streamId, publicPath),
    };
}

export async function buildSignedHlsUrl(
    streamId: string,
    playlistUrl?: string,
    showId?: string,
    purpose: "live" | "archive" | "private" = "live",
): Promise<SignedHlsUrl> {
    const { expiresAt, userId } = await getStreamToken(streamId, showId, purpose);
    const raw = playlistUrl?.trim()
        ? interpolateStreamId(playlistUrl.trim(), streamId)
        : buildHlsPlaylistUrl(streamId);

    if (isPlaceholderStreamId(raw) || raw.includes("{streamId}")) {
        throw new Error("A HLS URL sablon maradt: {streamId} helyett valódi ID kell.");
    }

    const url = raw.startsWith("http") ? sameOriginMediaUrl(raw) : raw;
    return {
        streamId,
        expiresAt,
        userId,
        cookie: true,
        url,
    };
}

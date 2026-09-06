import { API_URL, apiFetch } from "@/api/http";

export type StreamToken = {
    token: string;
    expiresAt: number;
    streamId: string;
    userId: string;
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
        expires: "3600",
        purpose,
    });
    if (showId?.trim()) {
        params.set("showId", showId.trim());
    }

    const data = await apiFetch(`/token/generate?${params.toString()}`);

    if (!data?.token || !data?.expiresAt || !data?.userId) {
        throw new Error("Érvénytelen stream token.");
    }

    return {
        token: String(data.token),
        expiresAt: Number(data.expiresAt),
        streamId: String(data.streamId || streamId),
        userId: String(data.userId || ""),
    };
}

export function withStreamToken(
    url: string,
    token: string,
    expiresAt: number,
    userId?: string,
) {
    const q = url.indexOf("?");
    const base = q === -1 ? url : url.slice(0, q);
    const params = new URLSearchParams(q === -1 ? "" : url.slice(q + 1));
    params.set("token", token);
    params.set("expiresAt", String(expiresAt));
    if (userId) params.set("userId", userId);
    return `${base}?${params.toString()}`;
}

export function buildHlsPlaylistUrl(streamId: string) {
    if (isPlaceholderStreamId(streamId)) {
        throw new Error("Hiányzik a stream ID. Add meg a műsor Stream ID mezőjét.");
    }

    return `${API_URL}/output/${encodeURIComponent(streamId)}/index.m3u8`;
}

export function buildArchiveUrl(streamId: string, publicPath?: string | null) {
    if (publicPath?.trim().startsWith("/")) {
        return `${API_URL}${publicPath.trim()}`;
    }
    if (isPlaceholderStreamId(streamId)) {
        throw new Error("Hiányzik a stream ID. Add meg a műsor Stream ID mezőjét.");
    }

    return `${API_URL}/output/${encodeURIComponent(streamId)}/archive.mp4`;
}

export async function buildSignedArchiveUrl(streamId: string, showId?: string, publicPath?: string | null) {
    const { token, expiresAt, streamId: signedId, userId } = await getStreamToken(streamId, showId, "archive");
    return {
        streamId: signedId || streamId,
        url: withStreamToken(buildArchiveUrl(streamId, publicPath), token, expiresAt, userId),
    };
}

export async function buildSignedHlsUrl(
    streamId: string,
    playlistUrl?: string,
    showId?: string,
    purpose: "live" | "archive" | "private" = "live",
): Promise<SignedHlsUrl> {
    const { token, expiresAt, userId } = await getStreamToken(streamId, showId, purpose);
    const raw = playlistUrl?.trim()
        ? interpolateStreamId(playlistUrl.trim(), streamId)
        : buildHlsPlaylistUrl(streamId);

    if (isPlaceholderStreamId(raw) || raw.includes("{streamId}")) {
        throw new Error("A HLS URL sablon maradt: {streamId} helyett valódi ID kell.");
    }

    return {
        streamId,
        token,
        expiresAt,
        userId,
        url: withStreamToken(raw, token, expiresAt, userId),
    };
}

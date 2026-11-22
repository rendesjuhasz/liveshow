import { apiFetch } from "@/api/http";
import { buildSignedArchiveUrl } from "@/lib/getStreamToken";

type Cached = {
    src?: string;
    info?: any;
    srcPromise?: Promise<string>;
    infoPromise?: Promise<any>;
};

const cache = new Map<string, Cached>();

function rowFor(showId: string) {
    const key = String(showId);
    let row = cache.get(key);
    if (!row) {
        row = {};
        cache.set(key, row);
    }
    return row;
}

export function peekArchiveSrc(showId: string) {
    return cache.get(String(showId))?.src || "";
}

export function peekArchiveInfo(showId: string) {
    return cache.get(String(showId))?.info || null;
}

export function isArchiveMissing(info: unknown) {
    const row = info as { exists?: boolean } | null | undefined;
    return Boolean(row) && row?.exists === false;
}

export class ArchiveMissingError extends Error {
    constructor() {
        super("ARCHIVE_MISSING");
        this.name = "ArchiveMissingError";
    }
}

async function signSrc(showId: string, streamId: string, publicPath?: string | null) {
    const signed = await buildSignedArchiveUrl(streamId, showId, publicPath);
    return signed.url;
}

export function warmArchivePlayback(
    showId: string,
    streamId?: string | null,
    publicPath?: string | null,
) {
    const row = rowFor(showId);
    if (row.src) return Promise.resolve(row.src);
    if (row.srcPromise) return row.srcPromise;
    row.srcPromise = loadArchiveInfo(showId)
        .then((info) => {
            if (isArchiveMissing(info)) throw new ArchiveMissingError();
            const sid = String(streamId || info?.streamId || "").trim();
            if (!sid) throw new Error("Hiányzik a stream ID.");
            return signSrc(showId, sid, publicPath || info?.publicPath);
        })
        .then((url) => {
            row.src = url;
            return url;
        })
        .catch((err) => {
            row.srcPromise = undefined;
            throw err;
        });
    return row.srcPromise;
}

export function loadArchiveInfo(showId: string) {
    const row = rowFor(showId);
    if (row.info) return Promise.resolve(row.info);
    if (row.infoPromise) return row.infoPromise;
    row.infoPromise = apiFetch(`/archives/${showId}`)
        .then((data) => {
            row.info = data;
            return data;
        })
        .catch((err) => {
            row.infoPromise = undefined;
            throw err;
        });
    return row.infoPromise;
}

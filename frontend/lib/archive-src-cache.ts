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
    const sid = String(streamId || "").trim();
    row.srcPromise = (sid
        ? signSrc(showId, sid, publicPath)
        : loadArchiveInfo(showId).then((info) => {
              if (!info?.streamId) throw new Error("Hiányzik a stream ID.");
              return signSrc(showId, info.streamId, info.publicPath);
          })
    )
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

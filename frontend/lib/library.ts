import { apiFetch } from "@/api/http";
import type { MediaItem } from "./media";
import { coverUrl, mediaId } from "./media";

export type LibraryCard = {
    id: string;
    title: string;
    image: string;
    startTime?: string | null;
    at: number;
};

const WATCH_PURGE = "liveshow:watch-purged:4";
const FAV_EVENT = "liveshow:favorites";

function key(kind: "fav" | "watch", userId?: string | null) {
    return `liveshow:${kind}:${userId || "anon"}`;
}

function purgeWatchLists() {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(WATCH_PURGE) === "1") return;
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("liveshow:watch:") || k.startsWith("liveshow:watch-cleared:")) remove.push(k);
    }
    for (const k of remove) localStorage.removeItem(k);
    localStorage.setItem(WATCH_PURGE, "1");
}

function read(kind: "fav" | "watch", userId?: string | null): LibraryCard[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(key(kind, userId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function write(kind: "fav" | "watch", userId: string | null | undefined, items: LibraryCard[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key(kind, userId), JSON.stringify(items.slice(0, 80)));
}

function snapshot(item: MediaItem): LibraryCard {
    return {
        id: mediaId(item),
        title: item.title || "Esemény",
        image: coverUrl(item),
        startTime: item.startTime,
        at: Date.now(),
    };
}

function emitFavorites() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(FAV_EVENT));
}

export function onFavoritesChange(handler: () => void) {
    if (typeof window === "undefined") return () => undefined;
    window.addEventListener(FAV_EVENT, handler);
    return () => window.removeEventListener(FAV_EVENT, handler);
}

export function getFavorites(userId?: string | null) {
    return read("fav", userId);
}

export function isFavorite(id: string, userId?: string | null) {
    return read("fav", userId).some((x) => x.id === id);
}

export function toggleFavorite(item: MediaItem, userId?: string | null) {
    const id = mediaId(item);
    const list = read("fav", userId);
    const next = list.some((x) => x.id === id)
        ? list.filter((x) => x.id !== id)
        : [snapshot(item), ...list];
    write("fav", userId, next);
    emitFavorites();
    return next.some((x) => x.id === id);
}

let remoteCards: LibraryCard[] = [];
let remoteLoaded = false;
let mergeInFlight: Promise<void> | null = null;

function asCards(data: unknown): LibraryCard[] {
    const rows = Array.isArray(data) ? data : [];
    return rows
        .map((row) => ({
            id: String(row?.id || "").trim(),
            title: String(row?.title || "Esemény"),
            image: String(row?.image || ""),
            startTime: row?.startTime ? String(row.startTime) : null,
            at: typeof row?.at === "number" ? row.at : Date.now(),
        }))
        .filter((row) => row.id);
}

export function remoteFavoriteCards() {
    return remoteCards;
}

export function clearRemoteFavorites() {
    remoteCards = [];
    remoteLoaded = false;
    emitFavorites();
}

export async function refreshRemoteFavorites() {
    const data = await apiFetch("/favorites");
    remoteCards = asCards(data);
    remoteLoaded = true;
    emitFavorites();
    return remoteCards;
}

export function isRemoteFavorite(id: string) {
    return remoteCards.some((row) => row.id === id);
}

export async function toggleAccountFavorite(item: MediaItem) {
    const id = mediaId(item);
    if (!id) return false;
    const on = isRemoteFavorite(id);
    if (on) {
        await apiFetch(`/favorites/${encodeURIComponent(id)}`, { method: "DELETE" });
        remoteCards = remoteCards.filter((row) => row.id !== id);
        emitFavorites();
        return false;
    }
    await apiFetch("/favorites", {
        method: "POST",
        body: JSON.stringify({ showId: id }),
    });
    remoteCards = [snapshot(item), ...remoteCards.filter((row) => row.id !== id)].slice(0, 80);
    emitFavorites();
    return true;
}

export async function mergeGuestFavorites(userId: string) {
    if (typeof window === "undefined" || !userId) return;
    if (mergeInFlight) return mergeInFlight;
    mergeInFlight = (async () => {
        const ids = [
            ...read("fav", null).map((row) => row.id),
            ...read("fav", userId).map((row) => row.id),
        ].filter(Boolean);
        if (ids.length) {
            try {
                const data = await apiFetch("/favorites/import", {
                    method: "POST",
                    body: JSON.stringify({ showIds: ids }),
                });
                remoteCards = asCards(data);
                remoteLoaded = true;
                write("fav", null, []);
                write("fav", userId, []);
                emitFavorites();
                return;
            } catch {
                /* username / háló — a helyi lista megmarad */
            }
        }
        try {
            await refreshRemoteFavorites();
        } catch {
            if (!remoteLoaded) remoteCards = [];
        }
    })().finally(() => {
        mergeInFlight = null;
    });
    return mergeInFlight;
}

export function getWatched(_userId?: string | null): LibraryCard[] {
    purgeWatchLists();
    return [];
}

export function recordWatched(_item: MediaItem, _userId?: string | null) {
    purgeWatchLists();
}

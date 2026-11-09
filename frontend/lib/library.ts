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
    return next.some((x) => x.id === id);
}

export function getWatched(_userId?: string | null): LibraryCard[] {
    purgeWatchLists();
    return [];
}

export function recordWatched(_item: MediaItem, _userId?: string | null) {
    purgeWatchLists();
}

import { detectBrowserTimeZone, formatEventDateTime } from "@/lib/timezone";

const COVER_POOL = [
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1492684223066-81342eea8107?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1459749411177-04aa81a87d47?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1574375927938-d5a34259514e?auto=format&fit=crop&w=1600&q=80",
];

function hashId(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h);
}

export type MediaItem = {
    id?: string;
    showId?: string;
    title?: string;
    description?: string;
    image?: string | null;
    startTime?: string | null;
    startAtUtc?: string | null;
    endAtUtc?: string | null;
    timezone?: string | null;
    scheduleStatus?: string | null;
    wentLiveAt?: string | null;
    ended?: boolean;
    featured?: boolean;
    price?: number;
    streamer?: { id?: string; name?: string | null } | null;
    streamId?: string | null;
    streamUrl?: string | null;
    live?: boolean;
    status?: string | null;
    videoCategory?: string | null;
    videoCategoryLabel?: string | null;
    exists?: boolean;
    viewerCount?: number;
    viewCount?: number;
};

export function mediaId(item: MediaItem) {
    return String(item.id || item.showId || "");
}

export function coverUrl(item: MediaItem) {
    if (item.image && /^https?:\/\//i.test(item.image)) return item.image;
    if (item.image && item.image.startsWith("/")) return item.image;
    const id = mediaId(item) || item.title || "show";
    return COVER_POOL[hashId(id) % COVER_POOL.length];
}

export function formatWhen(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return formatEventDateTime(d, detectBrowserTimeZone());
}

export function isUpcoming(item: MediaItem, now = Date.now()) {
    if (item.live) return false;
    if (item.scheduleStatus === "delayed") return true;
    if (item.scheduleStatus === "missed" || item.scheduleStatus === "ended") return false;
    if (item.ended) return false;
    if (item.endAtUtc && now >= new Date(item.endAtUtc).getTime() && item.wentLiveAt) return false;
    const start = item.startAtUtc || item.startTime;
    if (!start) return false;
    if (new Date(start).getTime() > now) return true;
    const startMs = new Date(start).getTime();
    return startMs <= now && now < startMs + 2 * 60 * 60 * 1000 && !item.wentLiveAt;
}

export function isEndedShow(item: MediaItem, now = Date.now()) {
    if (item.live) return false;
    if (item.scheduleStatus === "delayed" || item.scheduleStatus === "missed") return false;
    if (item.ended || item.scheduleStatus === "ended") return true;
    if (item.wentLiveAt) return true;
    if (String((item as { status?: string }).status || "") === "archived") return true;
    return false;
}

/** Streamer élő menü: meghirdetett, még nem lejátszott (vagy most élő), késő adás is. */
export function canGoLiveOnShow(
    item: Pick<MediaItem, "live" | "ended" | "scheduleStatus" | "startTime" | "startAtUtc" | "endAtUtc" | "wentLiveAt"> & {
        status?: string | null;
    },
    now = Date.now(),
) {
    if (item.live) return true;
    const status = String(item.status || "").toLowerCase();
    if (status === "blocked" || status === "archived") return false;
    if (status === "active" || status === "missed" || status === "pending" || status === "draft") {
        return !isEndedShow(
            {
                live: false,
                ended: item.ended,
                scheduleStatus: item.scheduleStatus,
                startTime: item.startTime,
                startAtUtc: item.startAtUtc || item.startTime,
                endAtUtc: item.endAtUtc,
                wentLiveAt: item.wentLiveAt,
                status,
            },
            now,
        );
    }
    return false;
}

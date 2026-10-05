export function formatCount(n?: number | null) {
    return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("en-US");
}

export function viewsLabel(n?: number | null) {
    return `${formatCount(n)} megtekintés`;
}

export function liveViewersLabel(n?: number | null) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    return `Jelenleg ${formatCount(count)} néző nézi`;
}

export function liveViewersShort(n?: number | null) {
    return `${formatCount(n)} néző`;
}

export function formatWatchDuration(seconds?: number | null) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s} mp`;
    const minutes = Math.floor(s / 60);
    const rem = s % 60;
    if (minutes < 60) {
        return rem ? `${minutes} p ${rem} mp` : `${minutes} perc`;
    }
    const hours = Math.floor(minutes / 60);
    const min = minutes % 60;
    return min ? `${hours} ó ${min} p` : `${hours} óra`;
}

export const ARCHIVE_SORTS = [
    { id: "popular", label: "Legnépszerűbb" },
    { id: "views", label: "Legtöbb megtekintés" },
    { id: "newest", label: "Legújabb" },
    { id: "oldest", label: "Legrégebbi" },
] as const;

export type ArchiveSortId = (typeof ARCHIVE_SORTS)[number]["id"];

export function formatCount(n?: number | null) {
    return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("hu-HU");
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

export const ARCHIVE_SORTS = [
    { id: "popular", label: "Legnépszerűbb" },
    { id: "views", label: "Legtöbb megtekintés" },
    { id: "newest", label: "Legújabb" },
    { id: "oldest", label: "Legrégebbi" },
] as const;

export type ArchiveSortId = (typeof ARCHIVE_SORTS)[number]["id"];

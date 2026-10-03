export const SHOW_STATUSES = [
    "draft",
    "pending",
    "active",
    "blocked",
    "archived",
    "missed",
] as const;

export type ShowStatus = (typeof SHOW_STATUSES)[number];

export function isShowStatus(value: string): value is ShowStatus {
    return (SHOW_STATUSES as readonly string[]).includes(value);
}

export function showStatusLabel(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
        case "pending":
            return "Jóváhagyásra vár";
        case "active":
            return "Aktív";
        case "blocked":
            return "Tiltott";
        case "archived":
            return "Archivált";
        case "missed":
            return "Elmaradt";
        default:
            return "Piszkozat";
    }
}

export const PUBLIC_CATALOG_STATUSES: ShowStatus[] = ["active"];
export const PUBLIC_DETAIL_STATUSES: ShowStatus[] = ["active", "archived", "missed"];
export const TICKET_SALE_STATUSES: ShowStatus[] = ["active"];
export const LIVE_ALLOWED_STATUSES: ShowStatus[] = ["active", "missed"];
export const ARCHIVE_LIST_STATUSES: ShowStatus[] = ["archived"];

export function normalizeShowStatus(status?: string | null): ShowStatus {
    const value = String(status || "").trim().toLowerCase();
    return isShowStatus(value) ? value : "draft";
}

export const SHOW_STATUSES = [
    "draft",
    "pending",
    "active",
    "blocked",
    "archived",
    "missed",
] as const;

export type ShowStatus = (typeof SHOW_STATUSES)[number];

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

export function showStatusClass(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
        case "pending":
            return "text-warning";
        case "active":
            return "text-success";
        case "blocked":
            return "text-danger";
        case "archived":
            return "text-neutral-400";
        case "missed":
            return "text-warning";
        default:
            return "text-blue-300";
    }
}

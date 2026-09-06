export const SHOW_STATUSES = [
    "draft",
    "pending",
    "active",
    "blocked",
    "archived",
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
        default:
            return "Piszkozat";
    }
}

export function showStatusClass(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
        case "pending":
            return "text-yellow-400";
        case "active":
            return "text-green-400";
        case "blocked":
            return "text-red-400";
        case "archived":
            return "text-neutral-400";
        default:
            return "text-blue-300";
    }
}

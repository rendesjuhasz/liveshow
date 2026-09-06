export const STREAMER_STATUSES = ["pending", "approved", "rejected", "banned"] as const;

export type StreamerStatus = (typeof STREAMER_STATUSES)[number];

export function streamerStatusLabel(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
        case "approved":
            return "Jóváhagyva";
        case "banned":
            return "Tiltva";
        case "rejected":
            return "Elutasítva";
        default:
            return "Jóváhagyásra vár";
    }
}

export function isApprovedStreamer(status?: string | null) {
    return String(status || "").trim().toLowerCase() === "approved";
}

export function userAccountStatusLabel(status?: string | null) {
    return String(status || "").toLowerCase() === "banned" ? "Tiltva" : "Aktív";
}

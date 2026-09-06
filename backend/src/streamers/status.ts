export const STREAMER_STATUSES = ["pending", "approved", "rejected", "banned"] as const;

export type StreamerStatus = (typeof STREAMER_STATUSES)[number];

export function isStreamerStatus(value: string): value is StreamerStatus {
    return (STREAMER_STATUSES as readonly string[]).includes(value);
}

export function isApprovedStreamer(status?: string | null) {
    return String(status || "").trim().toLowerCase() === "approved";
}

export function streamerStatusMessage(status?: string | null) {
    switch (String(status || "").trim().toLowerCase()) {
        case "banned":
            return "A streamer fiókod tiltva van.";
        case "rejected":
            return "A streamer jelentkezésed el lett utasítva.";
        default:
            return "A streamer fiókod még jóváhagyásra vár.";
    }
}

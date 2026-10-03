import { normalizeShowStatus } from "./show-status";

export const SHOW_MISS_AFTER_MS = 2 * 60 * 60 * 1000;

export type ShowAudiencePhase = "upcoming" | "delayed" | "live" | "missed" | "ended";

export type ShowLifecycleInput = {
    id?: string;
    live?: boolean | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
    status?: string | null;
    wentLiveAt?: Date | string | null;
};

export function hasEverGoneLive(show: ShowLifecycleInput) {
    if (show.live) return true;
    if (show.wentLiveAt) return true;
    return normalizeShowStatus(show.status) === "archived";
}

export function showAudiencePhase(show: ShowLifecycleInput, now = Date.now()): ShowAudiencePhase {
    if (show.live) return "live";
    const status = normalizeShowStatus(show.status);
    if (status === "archived" || hasEverGoneLive(show)) return "ended";
    if (status === "missed") return "missed";
    const start = show.startTime ? new Date(show.startTime).getTime() : NaN;
    if (Number.isNaN(start)) return "upcoming";
    if (now < start) return "upcoming";
    if (now >= start + SHOW_MISS_AFTER_MS) return "missed";
    return "delayed";
}

export function shouldPersistMissed(show: ShowLifecycleInput, now = Date.now()) {
    if (normalizeShowStatus(show.status) !== "active") return false;
    if (show.live || hasEverGoneLive(show)) return false;
    return showAudiencePhase(show, now) === "missed";
}

export function isEndedByFields(show: ShowLifecycleInput, now = Date.now()) {
    return showAudiencePhase(show, now) === "ended";
}

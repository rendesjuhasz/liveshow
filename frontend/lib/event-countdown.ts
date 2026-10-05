import { detectBrowserTimeZone, ymdInTimeZone, zonedLocalToUtc } from "./timezone";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type EventCountdown = {
    label: string;
    live: boolean;
    tickMs: number;
};

type CountdownItem = {
    startTime?: string | null;
    startAtUtc?: string | null;
    endAtUtc?: string | null;
    live?: boolean;
    ended?: boolean;
    scheduleStatus?: string | null;
};

export function getEventCountdown(
    item: CountdownItem,
    now = Date.now(),
    timeZone = detectBrowserTimeZone(),
): EventCountdown | null {
    if (item.ended || item.scheduleStatus === "ended") {
        return { label: "Ended", live: false, tickMs: 0 };
    }
    if (item.scheduleStatus === "missed") {
        return { label: "Missed", live: false, tickMs: 0 };
    }
    if (item.live || item.scheduleStatus === "live") {
        return { label: "Live now", live: true, tickMs: 0 };
    }
    if (item.scheduleStatus === "delayed") {
        return { label: "Delayed", live: false, tickMs: MINUTE };
    }
    const startIso = item.startAtUtc || item.startTime;
    if (!startIso) return null;
    const start = new Date(startIso).getTime();
    if (Number.isNaN(start)) return null;

    const remaining = start - now;
    if (remaining <= 0) {
        return { label: "Delayed", live: false, tickMs: MINUTE };
    }

    const today = ymdInTimeZone(new Date(now), timeZone);
    const startDay = ymdInTimeZone(new Date(start), timeZone);
    const tomorrow = ymdInTimeZone(new Date(now + DAY), timeZone);
    if (startDay === tomorrow || (startDay !== today && remaining < 36 * HOUR && remaining > HOUR)) {
        const todayStart = Date.parse(zonedNoon(today, timeZone));
        const eventDay = Date.parse(zonedNoon(startDay, timeZone));
        if (eventDay - todayStart === DAY || startDay === tomorrow) {
            return { label: "Starts tomorrow", live: false, tickMs: MINUTE };
        }
    }

    if (remaining >= DAY) {
        const days = Math.floor(remaining / DAY);
        return { label: `Starts in ${days} day${days === 1 ? "" : "s"}`, live: false, tickMs: MINUTE };
    }
    if (remaining >= HOUR) {
        const hours = Math.floor(remaining / HOUR);
        return {
            label: `Starts in ${hours} hour${hours === 1 ? "" : "s"}`,
            live: false,
            tickMs: MINUTE,
        };
    }
    if (remaining >= MINUTE) {
        const minutes = Math.floor(remaining / MINUTE);
        return {
            label: `Starts in ${minutes} min`,
            live: false,
            tickMs: remaining < 2 * MINUTE ? SECOND : MINUTE,
        };
    }
    const seconds = Math.max(1, Math.floor(remaining / SECOND));
    return { label: `Starts in ${seconds}s`, live: false, tickMs: SECOND };
}

function zonedNoon(ymd: string, timeZone: string) {
    try {
        return zonedLocalToUtc(`${ymd}T12:00`, timeZone).toISOString();
    } catch {
        return `${ymd}T12:00:00Z`;
    }
}

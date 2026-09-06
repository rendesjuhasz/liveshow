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
    live?: boolean;
    ended?: boolean;
};

export function getEventCountdown(item: CountdownItem, now = Date.now()): EventCountdown | null {
    if (item.ended) return null;
    if (item.live) {
        return { label: "🔴 ÉLŐ ADÁS", live: true, tickMs: 0 };
    }
    if (!item.startTime) return null;
    const start = new Date(item.startTime).getTime();
    if (Number.isNaN(start)) return null;

    const remaining = start - now;
    if (remaining <= 0) {
        return { label: "🔴 ÉLŐ ADÁS", live: true, tickMs: 0 };
    }
    if (remaining >= DAY) {
        const days = Math.floor(remaining / DAY);
        return { label: `⏳ ${days} nap múlva`, live: false, tickMs: MINUTE };
    }
    if (remaining >= HOUR) {
        const hours = Math.floor(remaining / HOUR);
        const minutes = Math.floor((remaining % HOUR) / MINUTE);
        return { label: `⏳ ${hours} óra ${minutes} perc`, live: false, tickMs: MINUTE };
    }
    if (remaining >= MINUTE) {
        const minutes = Math.floor(remaining / MINUTE);
        return {
            label: `⏳ ${minutes} perc`,
            live: false,
            tickMs: remaining < 2 * MINUTE ? SECOND : MINUTE,
        };
    }
    const seconds = Math.max(1, Math.floor(remaining / SECOND));
    return { label: `🔴 ${seconds} mp`, live: false, tickMs: SECOND };
}

export const DEFAULT_TIMEZONE = "Europe/Budapest";

export const COMMON_TIMEZONES = [
    "Europe/Budapest",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/Warsaw",
    "Europe/Bucharest",
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Singapore",
    "Asia/Dubai",
    "Australia/Sydney",
] as const;

export function detectBrowserTimeZone(): string {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) return tz;
    } catch {
        /* ignore */
    }
    return DEFAULT_TIMEZONE;
}

export function isValidIanaTimeZone(raw?: string | null): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: String(raw || "") }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

type WallParts = { y: number; m: number; d: number; h: number; min: number; s: number };

function pad(n: number) {
    return String(n).padStart(2, "0");
}

export function getTimeZoneParts(date: Date, timeZone: string): WallParts {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const map: Record<string, string> = {};
    for (const part of fmt.formatToParts(date)) {
        if (part.type !== "literal") map[part.type] = part.value;
    }
    return {
        y: Number(map.year),
        m: Number(map.month),
        d: Number(map.day),
        h: Number(map.hour),
        min: Number(map.minute),
        s: Number(map.second),
    };
}

export function parseWallClock(local: string): { y: number; m: number; d: number; h: number; min: number; s: number } {
    const m = String(local || "")
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/);
    if (!m) throw new Error("invalid local datetime");
    return {
        y: Number(m[1]),
        m: Number(m[2]),
        d: Number(m[3]),
        h: Number(m[4]),
        min: Number(m[5]),
        s: Number(m[6] || 0),
    };
}

export function zonedLocalToUtc(local: string, timeZone: string): Date {
    const p = parseWallClock(local);
    let utcMs = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    for (let i = 0; i < 4; i++) {
        const seen = getTimeZoneParts(new Date(utcMs), timeZone);
        const seenMs = Date.UTC(seen.y, seen.m - 1, seen.d, seen.h, seen.min, seen.s);
        const wantMs = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
        const delta = wantMs - seenMs;
        if (delta === 0) break;
        utcMs += delta;
    }
    return new Date(utcMs);
}

export function utcToWallClock(iso: string | Date, timeZone: string): string {
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const p = getTimeZoneParts(d, timeZone);
    return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

export function ymdInTimeZone(date: Date, timeZone: string): string {
    const p = getTimeZoneParts(date, timeZone);
    return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function formatEventDateTime(iso?: string | Date | null, timeZone?: string, locale = "hu-HU") {
    if (!iso) return "";
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(locale, {
        timeZone: timeZone && isValidIanaTimeZone(timeZone) ? timeZone : detectBrowserTimeZone(),
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

export function formatEventClock(iso?: string | Date | null, timeZone?: string, locale = "hu-HU") {
    if (!iso) return "";
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(locale, {
        timeZone: timeZone && isValidIanaTimeZone(timeZone) ? timeZone : detectBrowserTimeZone(),
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

export function formatUtcClock(iso?: string | Date | null) {
    return formatEventClock(iso, "UTC", "en-GB");
}

function icsUtcStamp(date: Date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function googleCalendarUrl(title: string, startAtUtc: string, endAtUtc: string, details = "") {
    const start = new Date(startAtUtc);
    const end = new Date(endAtUtc);
    const q = new URLSearchParams({
        action: "TEMPLATE",
        text: title,
        dates: `${icsUtcStamp(start)}/${icsUtcStamp(end)}`,
        details,
    });
    return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function outlookCalendarUrl(title: string, startAtUtc: string, endAtUtc: string, details = "") {
    const q = new URLSearchParams({
        rru: "addevent",
        subject: title,
        startdt: new Date(startAtUtc).toISOString(),
        enddt: new Date(endAtUtc).toISOString(),
        body: details,
        path: "/calendar/action/compose",
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

export function defaultEndIso(startAtUtc: string, hours = 2) {
    return new Date(new Date(startAtUtc).getTime() + hours * 3600_000).toISOString();
}

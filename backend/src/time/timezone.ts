import { BadRequestException } from "@nestjs/common";
import { showAudiencePhase, type ShowAudiencePhase } from "../shows/show-lifecycle";

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

export type ScheduleStatus = ShowAudiencePhase;

type WallParts = { y: number; m: number; d: number; h: number; min: number; s: number };

export function assertIanaTimeZone(raw?: string | null): string {
    const value = String(raw || "").trim() || DEFAULT_TIMEZONE;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    } catch {
        throw new BadRequestException("Ismeretlen időzóna.");
    }
    return value;
}

export function isValidIanaTimeZone(raw?: string | null): boolean {
    try {
        assertIanaTimeZone(raw);
        return true;
    } catch {
        return false;
    }
}

export function parseWallClock(local: string): WallParts {
    const m = String(local || "")
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/);
    if (!m) {
        throw new BadRequestException("Érvénytelen helyi időpont (YYYY-MM-DDTHH:mm).");
    }
    return {
        y: Number(m[1]),
        m: Number(m[2]),
        d: Number(m[3]),
        h: Number(m[4]),
        min: Number(m[5]),
        s: Number(m[6] || 0),
    };
}

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

export function zonedLocalToUtc(local: string, timeZone: string): Date {
    const tz = assertIanaTimeZone(timeZone);
    const p = parseWallClock(local);
    let utcMs = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    for (let i = 0; i < 4; i++) {
        const seen = getTimeZoneParts(new Date(utcMs), tz);
        const seenMs = Date.UTC(seen.y, seen.m - 1, seen.d, seen.h, seen.min, seen.s);
        const wantMs = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
        const delta = wantMs - seenMs;
        if (delta === 0) break;
        utcMs += delta;
    }
    return new Date(utcMs);
}

export function utcToWallClock(date: Date, timeZone: string): string {
    const p = getTimeZoneParts(date, assertIanaTimeZone(timeZone));
    return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

export function formatInTimeZone(
    date: Date | string | null | undefined,
    timeZone: string,
    locale = "hu-HU",
): string {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(locale, {
        timeZone: assertIanaTimeZone(timeZone),
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

export function formatTimeInZone(
    date: Date | string | null | undefined,
    timeZone: string,
    locale = "hu-HU",
): string {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(locale, {
        timeZone: assertIanaTimeZone(timeZone),
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

export function ymdInTimeZone(date: Date, timeZone: string): string {
    const p = getTimeZoneParts(date, assertIanaTimeZone(timeZone));
    return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function toUtcIso(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

export function scheduleStatus(input: {
    startAtUtc?: Date | string | null;
    endAtUtc?: Date | string | null;
    live?: boolean | null;
    now?: Date;
    showStatus?: string | null;
    wentLiveAt?: Date | string | null;
}): ScheduleStatus {
    return showAudiencePhase(
        {
            live: input.live,
            startTime: input.startAtUtc,
            endTime: input.endAtUtc,
            status: input.showStatus,
            wentLiveAt: input.wentLiveAt,
        },
        (input.now || new Date()).getTime(),
    );
}

export function icsUtcStamp(date: Date): string {
    return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
}

export function buildIcs(opts: {
    title: string;
    description?: string | null;
    url?: string;
    startAtUtc: Date;
    endAtUtc: Date;
    timezone: string;
}): string {
    const summary = escapeIcs(opts.title);
    const desc = escapeIcs(opts.description || "");
    const url = escapeIcs(opts.url || "");
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LiveShow//Streaming Platform//HU",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${icsUtcStamp(opts.startAtUtc)}-${summary.slice(0, 24)}@liveshow`,
        `DTSTAMP:${icsUtcStamp(new Date())}`,
        `DTSTART:${icsUtcStamp(opts.startAtUtc)}`,
        `DTEND:${icsUtcStamp(opts.endAtUtc)}`,
        `SUMMARY:${summary}`,
        desc ? `DESCRIPTION:${desc}\\nIdőzóna (streamer): ${escapeIcs(opts.timezone)}` : `DESCRIPTION:Időzóna (streamer): ${escapeIcs(opts.timezone)}`,
        url ? `URL:${url}` : "",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ]
        .filter((line) => line !== "")
        .join("\r\n");
}

export function googleCalendarUrl(opts: {
    title: string;
    details?: string;
    startAtUtc: Date;
    endAtUtc: Date;
}): string {
    const dates = `${icsUtcStamp(opts.startAtUtc)}/${icsUtcStamp(opts.endAtUtc)}`;
    const q = new URLSearchParams({
        action: "TEMPLATE",
        text: opts.title,
        dates,
        details: opts.details || "",
    });
    return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function outlookCalendarUrl(opts: {
    title: string;
    details?: string;
    startAtUtc: Date;
    endAtUtc: Date;
}): string {
    const q = new URLSearchParams({
        rru: "addevent",
        subject: opts.title,
        startdt: opts.startAtUtc.toISOString(),
        enddt: opts.endAtUtc.toISOString(),
        body: opts.details || "",
        path: "/calendar/action/compose",
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

export function defaultEndUtc(startAtUtc: Date, hours = 2): Date {
    return new Date(startAtUtc.getTime() + hours * 60 * 60 * 1000);
}

export function parseScheduleInput(data: {
    timezone?: string;
    startLocal?: string;
    endLocal?: string;
    startTime?: string;
    startAtUtc?: string;
    endTime?: string;
    endAtUtc?: string;
    date?: string;
}): { startAtUtc: Date | null; endAtUtc: Date | null; timezone: string } {
    const timezone = assertIanaTimeZone(data.timezone);
    let startAtUtc: Date | null = null;
    if (data.startLocal) {
        startAtUtc = zonedLocalToUtc(data.startLocal, timezone);
    } else {
        const raw = data.startAtUtc || data.startTime || data.date;
        if (raw) {
            const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim());
            startAtUtc = onlyDate
                ? zonedLocalToUtc(`${String(raw).trim()}T20:00`, timezone)
                : new Date(raw);
            if (Number.isNaN(startAtUtc.getTime())) {
                throw new BadRequestException("Érvénytelen kezdési időpont.");
            }
        }
    }
    let endAtUtc: Date | null = null;
    if (data.endLocal) {
        endAtUtc = zonedLocalToUtc(data.endLocal, timezone);
    } else {
        const raw = data.endAtUtc || data.endTime;
        if (raw) {
            endAtUtc = new Date(raw);
            if (Number.isNaN(endAtUtc.getTime())) {
                throw new BadRequestException("Érvénytelen befejezési időpont.");
            }
        }
    }
    if (startAtUtc && endAtUtc && endAtUtc.getTime() <= startAtUtc.getTime()) {
        throw new BadRequestException("A befejezésnek a kezdés után kell lennie.");
    }
    return { startAtUtc, endAtUtc, timezone };
}

function escapeIcs(value: string) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

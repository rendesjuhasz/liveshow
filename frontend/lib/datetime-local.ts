import { utcToWallClock, zonedLocalToUtc } from "@/lib/timezone";

/** iOS/Android datetime-local often includes seconds, ms, or a space. */
export function normalizeDatetimeLocal(raw: string): string {
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
    if (!m) return "";
    const hh = m[2].padStart(2, "0");
    return `${m[1]}T${hh}:${m[3]}`;
}

export function splitDatetimeLocal(raw: string): { date: string; time: string } {
    const n = normalizeDatetimeLocal(raw);
    if (!n) return { date: "", time: "" };
    const [date, time] = n.split("T");
    return { date: date || "", time: (time || "").slice(0, 5) };
}

export function joinDatetimeLocal(date: string, time: string): string {
    const d = String(date || "").trim();
    const t = String(time || "")
        .trim()
        .slice(0, 5);
    if (!d) return "";
    return `${d}T${t || "20:00"}`;
}

export function defaultUpcomingStartLocal(timeZone: string, hoursAhead = 2): string {
    return utcToWallClock(new Date(Date.now() + hoursAhead * 60 * 60 * 1000), timeZone);
}

export function showScheduleClientError(input: {
    title: string;
    videoCategory: string;
    startLocal: string;
    endLocal?: string;
    timezone: string;
}): string | null {
    const fields = showScheduleClientErrors(input);
    return fields.title || fields.videoCategory || fields.startTime || fields.endTime || fields.timezone || null;
}

export function showScheduleClientErrors(input: {
    title: string;
    videoCategory: string;
    startLocal: string;
    endLocal?: string;
    timezone: string;
}): { title?: string; videoCategory?: string; startTime?: string; endTime?: string; timezone?: string } {
    const fields: {
        title?: string;
        videoCategory?: string;
        startTime?: string;
        endTime?: string;
        timezone?: string;
    } = {};
    if (!String(input.title || "").trim()) fields.title = "Add meg a műsor címét.";
    if (!String(input.videoCategory || "").trim()) fields.videoCategory = "Válassz videókategóriát.";
    const start = normalizeDatetimeLocal(input.startLocal);
    if (!start) fields.startTime = "Add meg a kezdés dátumát és óráját.";
    try {
        if (start) {
            const startUtc = zonedLocalToUtc(start, input.timezone);
            if (startUtc.getTime() <= Date.now() - 60_000) {
                fields.startTime =
                    "A kezdésnek a jövőben kell lennie, különben a műsor az archívumba kerül, nem a Hamarosan listába.";
            }
            const end = normalizeDatetimeLocal(input.endLocal || "");
            if (end) {
                const endUtc = zonedLocalToUtc(end, input.timezone);
                if (endUtc.getTime() <= startUtc.getTime()) {
                    fields.endTime = "A befejezésnek a kezdés után kell lennie.";
                }
            }
        }
    } catch {
        fields.timezone = "Érvénytelen időpont vagy időzóna.";
    }
    return fields;
}

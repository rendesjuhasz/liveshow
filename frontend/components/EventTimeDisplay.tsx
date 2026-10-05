"use client";

import {
    detectBrowserTimeZone,
    formatEventClock,
    formatEventDateTime,
    formatUtcClock,
} from "@/lib/timezone";

export default function EventTimeDisplay({
    startAtUtc,
    compact = false,
}: {
    startAtUtc?: string | null;
    compact?: boolean;
}) {
    if (!startAtUtc) return null;
    const localTz = detectBrowserTimeZone();
    const clock = formatEventClock(startAtUtc, localTz);
    const full = formatEventDateTime(startAtUtc, localTz);
    const utc = formatUtcClock(startAtUtc);
    if (compact) {
        return (
            <span>
                {clock} (Your Local Time)
            </span>
        );
    }
    return (
        <div>
            <p>
                Event Time: <strong>{full}</strong>
            </p>
            <p className="text-sm text-neutral-400">Timezone: Your Local Time ({localTz})</p>
            <p className="text-xs text-neutral-500">
                {clock} (Your Local Time) · {utc} UTC
            </p>
        </div>
    );
}

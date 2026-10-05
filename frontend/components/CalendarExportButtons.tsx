"use client";

import { defaultEndIso, googleCalendarUrl, outlookCalendarUrl } from "@/lib/timezone";

export default function CalendarExportButtons({
    showId,
    title,
    startAtUtc,
    endAtUtc,
}: {
    showId: string;
    title: string;
    startAtUtc?: string | null;
    endAtUtc?: string | null;
}) {
    if (!startAtUtc) return null;
    const end = endAtUtc || defaultEndIso(startAtUtc);
    const google = googleCalendarUrl(title, startAtUtc, end);
    const outlook = outlookCalendarUrl(title, startAtUtc, end);
    const apple = `/api/shows/${encodeURIComponent(showId)}/calendar.ics`;

    return (
        <div className="mt-4 flex flex-wrap gap-2">
            <a
                href={google}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
                Google Calendar
            </a>
            <a
                href={outlook}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
                Outlook Calendar
            </a>
            <a href={apple} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
                Apple Calendar (.ics)
            </a>
        </div>
    );
}

"use client";

import {
    detectBrowserTimeZone,
    formatEventClock,
    formatEventDateTime,
    formatUtcClock,
} from "@/lib/timezone";
import { useT } from "@/lib/i18n/I18nProvider";

export default function EventTimeDisplay({
    startAtUtc,
    compact = false,
}: {
    startAtUtc?: string | null;
    compact?: boolean;
}) {
    const { t } = useT();
    if (!startAtUtc) return null;
    const localTz = detectBrowserTimeZone();
    const clock = formatEventClock(startAtUtc, localTz);
    const full = formatEventDateTime(startAtUtc, localTz);
    const utc = formatUtcClock(startAtUtc);
    const localLabel = t("show.localTime");
    if (compact) {
        return (
            <span>
                {clock} ({localLabel})
            </span>
        );
    }
    return (
        <div>
            <p>
                {t("show.eventTime")}: <strong>{full}</strong>
            </p>
            <p className="text-sm text-neutral-400">{t("show.timezoneLocal").replace("{tz}", localTz)}</p>
            <p className="text-xs text-neutral-500">
                {clock} ({localLabel}) · {utc} UTC
            </p>
        </div>
    );
}

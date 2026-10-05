"use client";

import TimezoneSelect from "@/components/TimezoneSelect";
import { joinDatetimeLocal, splitDatetimeLocal } from "@/lib/datetime-local";

const fieldClass = "min-h-12 w-full rounded-xl p-3 text-base text-black";

function DateTimePair({
    value,
    onChange,
    required,
}: {
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
}) {
    const { date, time } = splitDatetimeLocal(value);
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
                className={fieldClass}
                type="date"
                value={date}
                required={required}
                onChange={(e) => onChange(joinDatetimeLocal(e.target.value, time || "20:00"))}
            />
            <input
                className={fieldClass}
                type="time"
                value={time}
                required={required}
                step={60}
                onChange={(e) => onChange(joinDatetimeLocal(date, e.target.value))}
            />
        </div>
    );
}

export default function EventScheduleFields({
    startLocal,
    endLocal,
    timezone,
    onStartLocal,
    onEndLocal,
    onTimezone,
    requiredStart = true,
}: {
    startLocal: string;
    endLocal?: string;
    timezone: string;
    onStartLocal: (v: string) => void;
    onEndLocal?: (v: string) => void;
    onTimezone: (v: string) => void;
    requiredStart?: boolean;
}) {
    return (
        <div className="grid gap-3">
            <label className="grid gap-1">
                Kezdés (helyi idő a választott zónában)
                <DateTimePair value={startLocal} onChange={onStartLocal} required={requiredStart} />
                <span className="text-xs text-neutral-500">
                    Telefonon a dátum és az óra külön mező. A kezdésnek a jövőben kell lennie.
                </span>
            </label>
            {onEndLocal && (
                <label className="grid gap-1">
                    Befejezés (opcionális)
                    <DateTimePair value={endLocal || ""} onChange={onEndLocal} />
                </label>
            )}
            <label className="grid gap-1">
                Időzóna
                <TimezoneSelect value={timezone} onChange={onTimezone} />
                <span className="text-xs text-neutral-500">
                    Automatikusan a böngésző zónája. Felülírható. A szerver UTC-ben tárol.
                </span>
            </label>
        </div>
    );
}

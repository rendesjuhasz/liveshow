"use client";

import { FormFieldError, fieldControlClass } from "@/components/FormFieldError";
import TimezoneSelect from "@/components/TimezoneSelect";
import { SHOW_FIELD_IDS } from "@/lib/form-field-errors";
import { joinDatetimeLocal, splitDatetimeLocal } from "@/lib/datetime-local";

const fieldClass = "min-h-12 w-full rounded-xl p-3 text-base text-black";

function DateTimePair({
    value,
    onChange,
    required,
    dateId,
    invalid,
}: {
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
    dateId?: string;
    invalid?: boolean;
}) {
    const { date, time } = splitDatetimeLocal(value);
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
                id={dateId}
                className={fieldControlClass(invalid, fieldClass)}
                type="date"
                value={date}
                required={required}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid && dateId ? `${dateId}-error` : undefined}
                onChange={(e) => onChange(joinDatetimeLocal(e.target.value, time || "20:00"))}
            />
            <input
                className={fieldControlClass(invalid, fieldClass)}
                type="time"
                value={time}
                required={required}
                step={60}
                aria-invalid={invalid || undefined}
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
    startError,
    endError,
    timezoneError,
}: {
    startLocal: string;
    endLocal?: string;
    timezone: string;
    onStartLocal: (v: string) => void;
    onEndLocal?: (v: string) => void;
    onTimezone: (v: string) => void;
    requiredStart?: boolean;
    startError?: string;
    endError?: string;
    timezoneError?: string;
}) {
    return (
        <div className="grid gap-3">
            <label className="grid gap-1">
                Kezdés (helyi idő a választott zónában)
                <DateTimePair
                    value={startLocal}
                    onChange={onStartLocal}
                    required={requiredStart}
                    dateId={SHOW_FIELD_IDS.startTime}
                    invalid={Boolean(startError)}
                />
                <FormFieldError fieldId={SHOW_FIELD_IDS.startTime} message={startError} />
                <span className="text-xs text-neutral-500">
                    Telefonon a dátum és az óra külön mező. A kezdésnek a jövőben kell lennie.
                </span>
            </label>
            {onEndLocal && (
                <label className="grid gap-1">
                    Befejezés (opcionális)
                    <DateTimePair
                        value={endLocal || ""}
                        onChange={onEndLocal}
                        dateId={SHOW_FIELD_IDS.endTime}
                        invalid={Boolean(endError)}
                    />
                    <FormFieldError fieldId={SHOW_FIELD_IDS.endTime} message={endError} />
                </label>
            )}
            <label className="grid gap-1">
                Időzóna
                <TimezoneSelect
                    id={SHOW_FIELD_IDS.timezone}
                    value={timezone}
                    onChange={onTimezone}
                    invalid={Boolean(timezoneError)}
                />
                <FormFieldError fieldId={SHOW_FIELD_IDS.timezone} message={timezoneError} />
                <span className="text-xs text-neutral-500">
                    Automatikusan a böngésző zónája. Felülírható. A szerver UTC-ben tárol.
                </span>
            </label>
        </div>
    );
}

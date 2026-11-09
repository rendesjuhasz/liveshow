"use client";

import { fieldControlClass } from "@/components/FormFieldError";
import { COMMON_TIMEZONES, detectBrowserTimeZone, isValidIanaTimeZone } from "@/lib/timezone";

export default function TimezoneSelect({
    value,
    onChange,
    id,
    invalid,
}: {
    value: string;
    onChange: (tz: string) => void;
    id?: string;
    invalid?: boolean;
}) {
    const extra = value && !COMMON_TIMEZONES.includes(value as any) ? [value] : [];
    return (
        <select
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid && id ? `${id}-error` : undefined}
            className={fieldControlClass(invalid, "min-h-12 w-full rounded-xl p-3 text-base text-black")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {extra.concat([...COMMON_TIMEZONES]).map((tz) => (
                <option key={tz} value={tz}>
                    {tz}
                    {tz === detectBrowserTimeZone() ? " (böngésző)" : ""}
                </option>
            ))}
        </select>
    );
}

export function usePrefillTimeZone(initial?: string) {
    const detected = detectBrowserTimeZone();
    const tz = initial && isValidIanaTimeZone(initial) ? initial : detected;
    return tz;
}

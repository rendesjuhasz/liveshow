"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { FormFieldError, fieldControlClass } from "@/components/FormFieldError";
import { useStreamerGate } from "@/lib/useStreamerGate";
import VideoCategorySelect from "@/components/VideoCategorySelect";
import EventScheduleFields from "@/components/EventScheduleFields";
import { detectBrowserTimeZone } from "@/lib/timezone";
import {
    defaultUpcomingStartLocal,
    normalizeDatetimeLocal,
    showScheduleClientErrors,
} from "@/lib/datetime-local";
import {
    SHOW_FIELD_IDS,
    type ShowFieldErrors,
    focusFirstShowFieldError,
    splitApiFormError,
} from "@/lib/form-field-errors";
import {
    ShowTranslationGlobe,
    ShowTranslationsProvider,
    emptyShowTranslations,
    mergeShowTranslations,
    translationHasCopy,
} from "@/components/ShowContentTranslationsFields";
import { useT } from "@/lib/i18n/I18nProvider";
import { DEFAULT_LOCALE, isLocale, LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/messages";

export default function StreamerNewShowPage() {
    const gate = useStreamerGate();
    const { t, locale } = useT();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [timezone, setTimezone] = useState(detectBrowserTimeZone);
    const [startTime, setStartTime] = useState(() => defaultUpcomingStartLocal(detectBrowserTimeZone()));
    const [endTime, setEndTime] = useState("");
    const [streamId, setStreamId] = useState("");
    const [videoCategory, setVideoCategory] = useState("");
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<ShowFieldErrors>({});
    const [busy, setBusy] = useState(false);
    const [originalLocale, setOriginalLocale] = useState<Locale>(() =>
        isLocale(locale) ? locale : DEFAULT_LOCALE,
    );
    const [translations, setTranslations] = useState(() => emptyShowTranslations(locale));

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const startLocal = normalizeDatetimeLocal(startTime);
        const endLocal = normalizeDatetimeLocal(endTime) || undefined;
        const clientFields = showScheduleClientErrors({
            title,
            videoCategory,
            startLocal,
            endLocal,
            timezone,
        });
        if (Object.keys(clientFields).length) {
            setFieldErrors(clientFields);
            setError("");
            focusFirstShowFieldError(clientFields);
            return;
        }
        setFieldErrors({});
        setError("");
        setBusy(true);
        try {
            await apiFetch("/streamer/shows", {
                method: "POST",
                body: JSON.stringify({
                    title: title.trim(),
                    description,
                    startLocal,
                    endLocal,
                    timezone,
                    streamId,
                    videoCategory,
                    originalLocale,
                    translations,
                }),
            });
            router.push("/streamer/shows");
        } catch (err: any) {
            const split = splitApiFormError(err);
            setFieldErrors(split.fieldErrors);
            setError(split.formError || (Object.keys(split.fieldErrors).length ? "" : "Nem sikerült létrehozni a műsort."));
            if (Object.keys(split.fieldErrors).length) focusFirstShowFieldError(split.fieldErrors);
        } finally {
            setBusy(false);
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Új műsor létrehozása">
            <ShowTranslationsProvider
                value={translations}
                onChange={setTranslations}
                originalLocale={originalLocale}
            >
            <form
                noValidate
                onSubmit={submit}
                className="relative max-w-xl grid gap-4 rounded-2xl bg-neutral-900 p-6"
            >
                <p className="text-sm text-neutral-400">
                    A műsor a létrehozás után megjelenik a nézői oldalon a Hamarosan
                    eseményeknél. Ehhez jövőbeli kezdési időpont kell — az űrlap 2 órával
                    későbbre van előre kitöltve, ezt átírhatod.
                </p>
                <div className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="show-title">Cím</label>
                        <ShowTranslationGlobe field="title" />
                    </div>
                    <input
                        id={SHOW_FIELD_IDS.title}
                        className={fieldControlClass(Boolean(fieldErrors.title), "min-h-12 rounded-xl p-3 text-base text-black")}
                        aria-invalid={Boolean(fieldErrors.title) || undefined}
                        aria-describedby={fieldErrors.title ? `${SHOW_FIELD_IDS.title}-error` : undefined}
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, title: undefined }));
                        }}
                    />
                    <FormFieldError fieldId={SHOW_FIELD_IDS.title} message={fieldErrors.title} />
                </div>
                <label className="grid gap-1">
                    Kategória
                    <VideoCategorySelect
                        id={SHOW_FIELD_IDS.videoCategory}
                        value={videoCategory}
                        onChange={(value) => {
                            setVideoCategory(value);
                            setFieldErrors((prev) => ({ ...prev, videoCategory: undefined }));
                        }}
                        required={false}
                        invalid={Boolean(fieldErrors.videoCategory)}
                    />
                    <FormFieldError fieldId={SHOW_FIELD_IDS.videoCategory} message={fieldErrors.videoCategory} />
                </label>
                <div className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="show-description">Leírás</label>
                        <ShowTranslationGlobe field="description" />
                    </div>
                    <textarea
                        id={SHOW_FIELD_IDS.description}
                        className={fieldControlClass(Boolean(fieldErrors.description), "min-h-24 rounded-xl p-3 text-base text-black")}
                        aria-invalid={Boolean(fieldErrors.description) || undefined}
                        aria-describedby={fieldErrors.description ? `${SHOW_FIELD_IDS.description}-error` : undefined}
                        value={description}
                        onChange={(e) => {
                            setDescription(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, description: undefined }));
                        }}
                    />
                    <FormFieldError fieldId={SHOW_FIELD_IDS.description} message={fieldErrors.description} />
                </div>
                <label className="grid gap-1">
                    {t("studio.originalLocale")}
                    <select
                        className="min-h-12 rounded-xl p-3 text-base text-black"
                        value={originalLocale}
                        onChange={(e) => {
                            const next = e.target.value as Locale;
                            const existing = translations.find((row) => row.locale === next);
                            if (
                                translationHasCopy(existing) &&
                                !window.confirm(
                                    t("studio.translations.confirmOriginalChange").replace(
                                        "{lang}",
                                        LOCALE_META[next].nativeName,
                                    ),
                                )
                            ) {
                                return;
                            }
                            setOriginalLocale(next);
                            setTranslations((prev) => mergeShowTranslations(prev, next));
                        }}
                    >
                        {LOCALES.map((code) => (
                            <option key={code} value={code}>
                                {LOCALE_META[code].nativeName}
                            </option>
                        ))}
                    </select>
                </label>
                <EventScheduleFields
                    startLocal={startTime}
                    endLocal={endTime}
                    timezone={timezone}
                    onStartLocal={(value) => {
                        setStartTime(value);
                        setFieldErrors((prev) => ({ ...prev, startTime: undefined }));
                    }}
                    onEndLocal={(value) => {
                        setEndTime(value);
                        setFieldErrors((prev) => ({ ...prev, endTime: undefined }));
                    }}
                    onTimezone={(value) => {
                        setTimezone(value);
                        setFieldErrors((prev) => ({ ...prev, timezone: undefined }));
                    }}
                    requiredStart={false}
                    startError={fieldErrors.startTime}
                    endError={fieldErrors.endTime}
                    timezoneError={fieldErrors.timezone}
                />
                <label className="grid gap-1">
                    Stream ID (opcionális)
                    <input
                        id={SHOW_FIELD_IDS.streamId}
                        className={fieldControlClass(Boolean(fieldErrors.streamId), "min-h-12 rounded-xl p-3 text-base text-black")}
                        aria-invalid={Boolean(fieldErrors.streamId) || undefined}
                        aria-describedby={fieldErrors.streamId ? `${SHOW_FIELD_IDS.streamId}-error` : undefined}
                        value={streamId}
                        onChange={(e) => {
                            setStreamId(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, streamId: undefined }));
                        }}
                        placeholder="üresen automatikus"
                    />
                    <FormFieldError fieldId={SHOW_FIELD_IDS.streamId} message={fieldErrors.streamId} />
                </label>
                {error && (
                    <p className="rounded-xl bg-red-950/70 p-3 text-sm text-red-300" role="alert">
                        {error}
                    </p>
                )}
                <div className="sticky bottom-0 -mx-6 mt-2 border-t border-neutral-800 bg-neutral-900 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button
                        type="submit"
                        disabled={busy}
                        className="min-h-14 w-full rounded-xl bg-yellow-500 p-3 text-base font-bold text-black disabled:opacity-50"
                    >
                        {busy ? "Mentés..." : "Műsor közzététele"}
                    </button>
                </div>
            </form>
            </ShowTranslationsProvider>
        </StreamerShell>
    );
}

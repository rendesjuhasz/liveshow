"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { FormFieldError, fieldControlClass } from "@/components/FormFieldError";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { showStatusLabel } from "@/lib/show-status";
import VideoCategorySelect from "@/components/VideoCategorySelect";
import MarketingKitCard from "@/components/MarketingKitCard";
import EventScheduleFields from "@/components/EventScheduleFields";
import { detectBrowserTimeZone, utcToWallClock } from "@/lib/timezone";
import { normalizeDatetimeLocal, showScheduleClientErrors } from "@/lib/datetime-local";
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

export default function StreamerShowEditPage() {
    const gate = useStreamerGate();
    const { t } = useT();
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<ShowFieldErrors>({});
    const [status, setStatus] = useState("draft");
    const [videoCategory, setVideoCategory] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [timezone, setTimezone] = useState(detectBrowserTimeZone);
    const [busy, setBusy] = useState(false);
    const [originalLocale, setOriginalLocale] = useState<Locale>(DEFAULT_LOCALE);
    const [translations, setTranslations] = useState(() => emptyShowTranslations());

    useEffect(() => {
        if (!gate.ok || !id) return;
        apiFetch(`/streamer/shows/${id}`)
            .then((show) => {
                setTitle(show?.title || "");
                setDescription(show?.description || "");
                setStatus(show?.status || "draft");
                setVideoCategory(show?.videoCategory || "");
                if (show?.timezone) setTimezone(show.timezone);
                const tz = show?.timezone || detectBrowserTimeZone();
                if (show?.startAtUtc || show?.startTime) {
                    setStartTime(utcToWallClock(show.startAtUtc || show.startTime, tz));
                }
                if (show?.endAtUtc) setEndTime(utcToWallClock(show.endAtUtc, tz));
                const nextOriginal = isLocale(show?.originalLocale) ? show.originalLocale : DEFAULT_LOCALE;
                setOriginalLocale(nextOriginal);
                setTranslations(mergeShowTranslations(show?.translations, nextOriginal));
            })
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni."));
    }, [gate.ok, id]);

    async function save() {
        await apiFetch(`/streamer/shows/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
                title,
                description,
                videoCategory,
                startLocal: normalizeDatetimeLocal(startTime),
                endLocal: normalizeDatetimeLocal(endTime) || undefined,
                timezone,
                originalLocale,
                translations,
            }),
        });
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title={`Műsor: ${title}`}>
            <p className="text-neutral-400 mb-4">Státusz: {showStatusLabel(status)}</p>
            <p className="text-sm text-neutral-500 mb-4 max-w-xl">
                Ha a státusz Aktív és a kezdés a jövőben van, a műsor a nézői Főoldalon a
                Hamarosan eseményeknél látszik.
            </p>
            <ShowTranslationsProvider
                value={translations}
                onChange={setTranslations}
                originalLocale={originalLocale}
            >
            <form
                noValidate
                className="max-w-xl grid gap-3 bg-neutral-900 p-6 rounded-2xl"
                onSubmit={async (e) => {
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
                        await save();
                        router.push("/streamer/shows");
                    } catch (err: any) {
                        const split = splitApiFormError(err);
                        setFieldErrors(split.fieldErrors);
                        setError(split.formError || (Object.keys(split.fieldErrors).length ? "" : "Nem sikerült menteni."));
                        if (Object.keys(split.fieldErrors).length) focusFirstShowFieldError(split.fieldErrors);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <div className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="show-title">Cím</label>
                        <ShowTranslationGlobe field="title" />
                    </div>
                    <input
                        id={SHOW_FIELD_IDS.title}
                        className={fieldControlClass(Boolean(fieldErrors.title), "p-3 rounded text-black")}
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
                <div className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="show-description">Leírás</label>
                        <ShowTranslationGlobe field="description" />
                    </div>
                    <textarea
                        id={SHOW_FIELD_IDS.description}
                        className={fieldControlClass(Boolean(fieldErrors.description), "p-3 rounded text-black min-h-24")}
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
                        className="p-3 rounded text-black"
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
                {error && <p className="text-red-400">{error}</p>}
                <button
                    disabled={busy}
                    className="bg-yellow-500 text-black font-bold p-3 rounded-xl disabled:opacity-50"
                >
                    Mentés
                </button>
                {(status === "draft" || status === "pending") && (
                    <button
                        type="button"
                        disabled={busy}
                        className="bg-blue-600 font-bold p-3 rounded-xl disabled:opacity-50"
                        onClick={async () => {
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
                                await save();
                                await apiFetch(`/streamer/shows/${id}/submit`, { method: "POST" });
                                router.push("/streamer/shows");
                            } catch (err: any) {
                                const split = splitApiFormError(err);
                                setFieldErrors(split.fieldErrors);
                                setError(split.formError || (Object.keys(split.fieldErrors).length ? "" : "A közzététel nem sikerült."));
                                if (Object.keys(split.fieldErrors).length) focusFirstShowFieldError(split.fieldErrors);
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Közzététel a nézői oldalon
                    </button>
                )}
            </form>
            </ShowTranslationsProvider>
            {id ? <MarketingKitCard showId={String(id)} /> : null}
        </StreamerShell>
    );
}

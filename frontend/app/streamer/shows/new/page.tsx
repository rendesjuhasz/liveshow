"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import VideoCategorySelect from "@/components/VideoCategorySelect";
import EventScheduleFields from "@/components/EventScheduleFields";
import { detectBrowserTimeZone } from "@/lib/timezone";
import {
    defaultUpcomingStartLocal,
    normalizeDatetimeLocal,
    showScheduleClientError,
} from "@/lib/datetime-local";
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
    const [busy, setBusy] = useState(false);
    const [originalLocale, setOriginalLocale] = useState<Locale>(() =>
        isLocale(locale) ? locale : DEFAULT_LOCALE,
    );
    const [translations, setTranslations] = useState(() => emptyShowTranslations(locale));

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const startLocal = normalizeDatetimeLocal(startTime);
        const endLocal = normalizeDatetimeLocal(endTime) || undefined;
        const clientError = showScheduleClientError({
            title,
            videoCategory,
            startLocal,
            endLocal,
            timezone,
        });
        if (clientError) {
            setError(clientError);
            return;
        }
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
            setError(err.message || "Nem sikerült létrehozni a műsort.");
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
                        id="show-title"
                        className="min-h-12 rounded-xl p-3 text-base text-black"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <label className="grid gap-1">
                    Kategória
                    <VideoCategorySelect value={videoCategory} onChange={setVideoCategory} required={false} />
                </label>
                <div className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="show-description">Leírás</label>
                        <ShowTranslationGlobe field="description" />
                    </div>
                    <textarea
                        id="show-description"
                        className="min-h-24 rounded-xl p-3 text-base text-black"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
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
                    onStartLocal={setStartTime}
                    onEndLocal={setEndTime}
                    onTimezone={setTimezone}
                    requiredStart={false}
                />
                <label className="grid gap-1">
                    Stream ID (opcionális)
                    <input
                        className="min-h-12 rounded-xl p-3 text-base text-black"
                        value={streamId}
                        onChange={(e) => setStreamId(e.target.value)}
                        placeholder="üresen automatikus"
                    />
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

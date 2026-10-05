"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { showStatusLabel } from "@/lib/show-status";
import VideoCategorySelect from "@/components/VideoCategorySelect";
import MarketingKitCard from "@/components/MarketingKitCard";
import EventScheduleFields from "@/components/EventScheduleFields";
import { detectBrowserTimeZone, utcToWallClock } from "@/lib/timezone";
import { normalizeDatetimeLocal, showScheduleClientError } from "@/lib/datetime-local";

export default function StreamerShowEditPage() {
    const gate = useStreamerGate();
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState("draft");
    const [videoCategory, setVideoCategory] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [timezone, setTimezone] = useState(detectBrowserTimeZone);
    const [busy, setBusy] = useState(false);

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
            <form
                noValidate
                className="max-w-xl grid gap-3 bg-neutral-900 p-6 rounded-2xl"
                onSubmit={async (e) => {
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
                        await save();
                        router.push("/streamer/shows");
                    } catch (err: any) {
                        setError(err.message || "Nem sikerült menteni.");
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <label className="grid gap-1">
                    Cím
                    <input
                        className="p-3 rounded text-black"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </label>
                <label className="grid gap-1">
                    Leírás
                    <textarea
                        className="p-3 rounded text-black min-h-24"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </label>
                <EventScheduleFields
                    startLocal={startTime}
                    endLocal={endTime}
                    timezone={timezone}
                    onStartLocal={setStartTime}
                    onEndLocal={setEndTime}
                    onTimezone={setTimezone}
                />
                <label className="grid gap-1">
                    Kategória
                    <VideoCategorySelect value={videoCategory} onChange={setVideoCategory} />
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
                            setError("");
                            setBusy(true);
                            try {
                                await save();
                                await apiFetch(`/streamer/shows/${id}/submit`, { method: "POST" });
                                router.push("/streamer/shows");
                            } catch (err: any) {
                                setError(err.message || "A közzététel nem sikerült.");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Közzététel a nézői oldalon
                    </button>
                )}
            </form>
            {id ? <MarketingKitCard showId={String(id)} /> : null}
        </StreamerShell>
    );
}

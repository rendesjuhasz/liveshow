"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { showStatusClass, showStatusLabel } from "@/lib/show-status";
import { videoCategoryLabel } from "@/lib/video-categories";
import { formatWatchDuration } from "@/lib/views";
import { useT } from "@/lib/i18n/I18nProvider";

type ShowRow = {
    id: string;
    title: string;
    status?: string;
    scheduleStatus?: string;
    startTime?: string | null;
    startAtUtc?: string | null;
    videoCategory?: string | null;
    viewCount?: number;
    peakViewers?: number;
    avgWatchSeconds?: number;
};

function ShowList({
    shows,
    onPublished,
    onError,
}: {
    shows: ShowRow[];
    onPublished: (rows: ShowRow[]) => void;
    onError: (message: string) => void;
}) {
    const { formatDateTime, formatNumber, t } = useT();
    if (!shows.length) return <p className="text-neutral-500">Nincs ilyen műsor.</p>;
    return (
        <ul className="space-y-3">
            {shows.map((show) => (
                <li key={show.id} className="flex flex-wrap justify-between gap-3 rounded-xl bg-neutral-900 p-4">
                    <div>
                        <p className="font-semibold">{show.title}</p>
                        <p className="text-sm text-neutral-400">
                            <span className={showStatusClass(show.status)}>
                                {show.scheduleStatus === "delayed"
                                    ? "Késik"
                                    : showStatusLabel(show.status)}
                            </span>
                            {" · "}
                            {show.startTime
                                ? formatDateTime(show.startAtUtc || show.startTime)
                                : "nincs dátum"}
                            {show.videoCategory ? ` · ${videoCategoryLabel(show.videoCategory)}` : ""}
                            {show.status === "archived"
                                ? ` · ${t("media.views").replace("{n}", formatNumber(show.viewCount || 0))}`
                                : ""}
                            {show.peakViewers ? ` · peak ${formatNumber(show.peakViewers)}` : ""}
                            {show.avgWatchSeconds
                                ? ` · átlag ${formatWatchDuration(show.avgWatchSeconds)}`
                                : ""}
                        </p>
                    </div>
                    <span className="flex items-center gap-3 text-sm text-blue-400">
                        {(show.status === "draft" || show.status === "pending" || show.status === "rejected") && (
                            <button
                                type="button"
                                className="text-yellow-400"
                                onClick={async () => {
                                    try {
                                        await apiFetch(`/streamer/shows/${show.id}/submit`, { method: "POST" });
                                        const rows = await apiFetch("/streamer/shows");
                                        onPublished(Array.isArray(rows) ? rows : []);
                                    } catch (err: unknown) {
                                        onError(err instanceof Error ? err.message : "A közzététel nem sikerült.");
                                    }
                                }}
                            >
                                Közzététel
                            </button>
                        )}
                        <Link href={`/streamer/shows/${show.id}`}>Szerkesztés</Link>
                        {show.status === "archived" ? (
                            <Link href={`/archive/${show.id}`}>Nyilvános</Link>
                        ) : show.status === "active" || show.status === "missed" ? (
                            <Link href={`/shows/${show.id}`}>Nyilvános</Link>
                        ) : null}
                    </span>
                </li>
            ))}
        </ul>
    );
}

export default function StreamerShowsPage() {
    const gate = useStreamerGate();
    const [shows, setShows] = useState<ShowRow[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/shows")
            .then((d) => setShows(Array.isArray(d) ? d : []))
            .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Nem sikerült betölteni a műsorokat."),
            );
    }, [gate.ok]);

    const upcoming = useMemo(
        () => shows.filter((s) => String(s.status || "") !== "archived" && String(s.status || "") !== "blocked"),
        [shows],
    );
    const archived = useMemo(
        () => shows.filter((s) => String(s.status || "") === "archived"),
        [shows],
    );

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Saját műsorok">
            <div className="mb-6">
                <Link href="/streamer/shows/new" className="rounded-lg bg-yellow-500 px-4 py-2 font-bold text-black">
                    Új műsor
                </Link>
                <Link
                    href="/streamer/vod"
                    className="ml-3 rounded-lg bg-neutral-800 px-4 py-2 font-bold text-yellow-400"
                >
                    Videó feltöltése
                </Link>
            </div>
            {error && <p className="mb-4 text-red-400">{error}</p>}
            <p className="mb-6 max-w-xl text-sm text-neutral-500">
                Aktív: meghirdetett, késő és elmaradt műsorok. Archivált: csak a ténylegesen
                lejátszott, majd leállított adások. Az élő indítás az Élő menüben van.
            </p>
            {shows.length === 0 && <p className="text-neutral-400">Még nincs saját műsorod.</p>}
            {shows.length > 0 && (
                <div className="grid gap-10">
                    <section>
                        <h2 className="mb-3 text-lg font-semibold">Aktív</h2>
                        <ShowList shows={upcoming} onPublished={setShows} onError={setError} />
                    </section>
                    <section>
                        <h2 className="mb-3 text-lg font-semibold">Archivált</h2>
                        <ShowList shows={archived} onPublished={setShows} onError={setError} />
                    </section>
                </div>
            )}
        </StreamerShell>
    );
}

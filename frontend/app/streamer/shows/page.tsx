"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { showStatusClass, showStatusLabel } from "@/lib/show-status";
import { videoCategoryLabel } from "@/lib/video-categories";

export default function StreamerShowsPage() {
    const gate = useStreamerGate();
    const [shows, setShows] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/shows")
            .then((d) => setShows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a műsorokat."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Saját műsorok">
            <div className="mb-6">
                <Link href="/streamer/shows/new" className="bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg">
                    Új műsor
                </Link>
                <Link href="/streamer/vod" className="ml-3 bg-neutral-800 text-yellow-400 font-bold px-4 py-2 rounded-lg">
                    Videó feltöltése
                </Link>
            </div>
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <p className="mb-4 max-w-xl text-sm text-neutral-500">
                A piszkozat vagy jóváhagyásra váró műsor nem látszik a nézőknél. Nyomd meg a
                Közzététel gombot, jövőbeli kezdéssel.
            </p>
            {shows.length === 0 && <p className="text-neutral-400">Még nincs saját műsorod.</p>}
            <ul className="space-y-3">
                {shows.map((show) => (
                    <li key={show.id} className="bg-neutral-900 p-4 rounded-xl flex flex-wrap justify-between gap-3">
                        <div>
                            <p className="font-semibold">{show.title}</p>
                            <p className="text-sm text-neutral-400">
                                <span className={showStatusClass(show.status)}>{showStatusLabel(show.status)}</span>
                                {" · "}
                                {show.startTime ? new Date(show.startTime).toLocaleString("hu-HU") : "nincs dátum"}
                                {show.videoCategory ? ` · ${videoCategoryLabel(show.videoCategory)}` : ""}
                                {show.live ? " · élő" : ""}
                                {show.live
                                    ? ` · ${Number(show.viewerCount || 0).toLocaleString("hu-HU")} néző`
                                    : ` · ${Number(show.viewCount || 0).toLocaleString("hu-HU")} megtekintés`}
                            </p>
                        </div>
                        <span className="flex gap-3 text-blue-400 text-sm items-center">
                            {(show.status === "draft" || show.status === "pending" || show.status === "rejected") && (
                                <button
                                    type="button"
                                    className="text-yellow-400"
                                    onClick={async () => {
                                        try {
                                            await apiFetch(`/streamer/shows/${show.id}/submit`, { method: "POST" });
                                            const rows = await apiFetch("/streamer/shows");
                                            setShows(Array.isArray(rows) ? rows : []);
                                        } catch (err: any) {
                                            setError(err.message || "A közzététel nem sikerült.");
                                        }
                                    }}
                                >
                                    Közzététel
                                </button>
                            )}
                            <Link href={`/streamer/shows/${show.id}`}>Szerkesztés</Link>
                            <Link href={`/streamer/live?show=${show.id}`}>Élő</Link>
                            {show.status === "active" || show.status === "archived" ? (
                                <Link href={show.status === "archived" ? `/archive/${show.id}` : `/shows/${show.id}`}>
                                    Nyilvános
                                </Link>
                            ) : null}
                        </span>
                    </li>
                ))}
            </ul>
        </StreamerShell>
    );
}

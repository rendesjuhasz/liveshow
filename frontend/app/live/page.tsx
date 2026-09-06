"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import EventCard from "@/components/media/EventCard";
import { mediaId, type MediaItem } from "@/lib/media";

export default function LiveIndexPage() {
    const [shows, setShows] = useState<MediaItem[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const data = await apiFetch("/shows/live");
                if (!cancelled) setShows(Array.isArray(data) ? data : []);
            } catch (err: any) {
                if (!cancelled) setError(err.message || "Nem sikerült betölteni az élő műsorokat.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        const t = setInterval(load, 8000);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, []);

    return (
        <div className="min-h-dvh px-4 py-8 md:px-10">
            <h1 className="mb-2 text-3xl font-extrabold">Élő közvetítések</h1>
            <p className="mb-8 text-sm text-zinc-400">
                Most nézhető élő közvetítések. A műsorok szabadon megtekinthetők, az interaktív
                funkciókhoz jegy használható.
            </p>
            {loading && <p className="text-zinc-400">Betöltés...</p>}
            {error && <p className="text-red-400">{error}</p>}
            {!loading && shows.length === 0 && <p className="text-zinc-400">Most nincs élő adás.</p>}
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start sm:gap-4">
                {shows.map((show) => (
                    <EventCard key={mediaId(show)} item={show} href={`/live/${mediaId(show)}`} wide />
                ))}
            </div>
        </div>
    );
}

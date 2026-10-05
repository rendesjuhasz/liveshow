"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import EventCard from "@/components/media/EventCard";
import { mediaId, type MediaItem } from "@/lib/media";
import { useT } from "@/lib/i18n/I18nProvider";

export default function LiveIndexPage() {
    const { t } = useT();
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
                if (!cancelled) setError(err.message || t("live.loadError"));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        const timer = setInterval(load, 15_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [t]);

    return (
        <div className="min-h-dvh px-4 py-8 md:px-10">
            <h1 className="mb-2 text-3xl font-extrabold">{t("live.title")}</h1>
            <p className="mb-8 text-sm text-zinc-400">{t("live.lead")}</p>
            {loading && <p className="text-zinc-400">{t("common.loading")}</p>}
            {error && <p className="text-red-400">{error}</p>}
            {!loading && shows.length === 0 && <p className="text-zinc-400">{t("live.empty")}</p>}
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start sm:gap-4">
                {shows.map((show) => (
                    <EventCard key={mediaId(show)} item={show} href={`/live/${mediaId(show)}`} wide />
                ))}
            </div>
        </div>
    );
}

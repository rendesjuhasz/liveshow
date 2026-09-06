"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import EventCard from "@/components/media/EventCard";
import type { MediaItem } from "@/lib/media";
import { useT } from "@/lib/i18n/I18nProvider";

export default function ShowsPage() {
    const { t, locale } = useT();
    const [shows, setShows] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        apiFetch("/shows")
            .then((data) => setShows(Array.isArray(data) ? data : []))
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a műsorokat."))
            .finally(() => setLoading(false));
    }, [locale]);

    return (
        <div className="min-h-dvh px-4 py-8 md:px-10">
            <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t("shows.title")}</h1>
            {loading && <p className="text-zinc-400">{t("common.loading")}</p>}
            {error && <p className="text-red-400">{error}</p>}
            {!loading && shows.length === 0 && <p className="text-zinc-400">Nincs elérhető esemény.</p>}
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start sm:gap-4">
                {shows.map((show) => (
                    <EventCard key={show.id} item={show} />
                ))}
            </div>
        </div>
    );
}

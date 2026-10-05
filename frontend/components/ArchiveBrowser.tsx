"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import EventCard from "@/components/media/EventCard";
import ArchiveCategoryFilter from "@/components/ArchiveCategoryFilter";
import type { MediaItem } from "@/lib/media";
import { isVideoCategory, videoCategoryLabel } from "@/lib/video-categories";
import { ARCHIVE_SORTS, type ArchiveSortId } from "@/lib/views";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/I18nProvider";

function mapArchive(item: any): MediaItem {
    return {
        id: item.showId,
        showId: item.showId,
        title: item.title,
        startTime: item.startTime,
        image: item.image,
        streamer: item.streamer ? { name: item.streamer } : null,
        ended: true,
        videoCategory: item.videoCategory,
        videoCategoryLabel: item.videoCategoryLabel,
        streamId: item.streamId,
        exists: item.exists,
        viewCount: Number(item.viewCount) || 0,
    };
}

export default function ArchiveBrowser({ category }: { category?: string }) {
    const { t } = useT();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<ArchiveSortId>("newest");
    const valid = !category || isVideoCategory(category);

    useEffect(() => {
        if (category && !isVideoCategory(category)) {
            setLoading(false);
            setItems([]);
            setError(t("archive.unknownCat"));
            return;
        }
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ sort });
        if (category) params.set("category", category);
        apiFetch(`/archives?${params.toString()}`)
            .then((data) => setItems((Array.isArray(data) ? data : []).map(mapArchive)))
            .catch((err: any) => setError(err.message || t("archive.loadError")))
            .finally(() => setLoading(false));
    }, [category, sort, t]);

    const heading = category && valid ? videoCategoryLabel(category) : t("archive.heading");

    return (
        <div className="min-h-dvh px-4 py-8 md:px-10">
            <h1 className="mb-2 text-3xl font-extrabold">{heading}</h1>
            <p className="mb-6 text-sm text-zinc-400">{t("archive.lead")}</p>
            <ArchiveCategoryFilter active={valid ? category : undefined} />
            <div className="mb-6 flex flex-wrap gap-2">
                {ARCHIVE_SORTS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setSort(option.id)}
                        className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                            sort === option.id
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-white/15 text-zinc-300 hover:border-white/40",
                        )}
                    >
                        {t(`archive.sort.${option.id}`)}
                    </button>
                ))}
            </div>
            {loading && <p className="text-zinc-400">{t("common.loading")}</p>}
            {error && <p className="text-red-400">{error}</p>}
            {!loading && !error && items.length === 0 && (
                <p className="text-zinc-400">{category ? t("archive.emptyCat") : t("archive.empty")}</p>
            )}
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start sm:gap-4">
                {items.map((item) => (
                    <EventCard key={item.id} item={item} href={`/archive/${item.id}`} wide hoverPreview />
                ))}
            </div>
        </div>
    );
}

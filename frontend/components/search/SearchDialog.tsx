"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { apiFetch } from "@/api/http";
import { coverUrl, mediaId, type MediaItem } from "@/lib/media";
import { useT } from "@/lib/i18n/I18nProvider";
import LocaleLink from "@/components/LocaleLink";
import { VIDEO_CATEGORIES } from "@/lib/video-categories";
import { cn } from "@/lib/utils";

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t, locale } = useT();
    const [q, setQ] = useState("");
    const [category, setCategory] = useState("");
    const [all, setAll] = useState<MediaItem[]>([]);

    useEffect(() => {
        if (!open) return;
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (category) params.set("category", category);
        const url = params.toString() ? `/shows/search?${params.toString()}` : "/shows";
        apiFetch(url)
            .then((d) => setAll(Array.isArray(d) ? d : []))
            .catch(() => setAll([]));
    }, [open, q, category, locale]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const needle = q.trim().toLowerCase();
    const hits = all.slice(0, needle || category ? 40 : 8);

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 px-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md" onClick={onClose}>
            <div
                className="mx-auto mt-16 w-full max-w-2xl sm:mt-20"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3">
                    <Search className="size-5 shrink-0 text-zinc-400" />
                    <input
                        autoFocus
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t("search.placeholder")}
                        className="h-11 min-w-0 w-full bg-transparent text-base outline-none placeholder:text-zinc-500 md:text-lg"
                    />
                    <button type="button" className="flex size-11 shrink-0 items-center justify-center" onClick={onClose} aria-label={t("search.close")}>
                        <X className="size-5 text-zinc-400" />
                    </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setCategory("")}
                        className={cn(
                            "rounded-full px-3 py-1.5 text-sm",
                            !category
                                ? "bg-accent font-semibold text-black"
                                : "bg-white/10 text-zinc-200 hover:bg-white/15",
                        )}
                    >
                        {t("search.allCategories")}
                    </button>
                    {VIDEO_CATEGORIES.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setCategory(item.value === category ? "" : item.value)}
                            className={cn(
                                "rounded-full px-3 py-1.5 text-sm",
                                category === item.value
                                    ? "bg-accent font-semibold text-black"
                                    : "bg-white/10 text-zinc-200 hover:bg-white/15",
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="mt-3 max-h-[min(60dvh,24rem)] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-2">
                    {hits.length === 0 && (
                        <p className="p-6 text-center text-sm text-zinc-500">{t("search.noHits")}</p>
                    )}
                    {hits.map((item) => {
                        const id = mediaId(item);
                        const href = item.live
                            ? `/live/${id}`
                            : item.ended
                              ? `/archive/${id}`
                              : `/shows/${id}`;
                        return (
                            <LocaleLink
                                key={id}
                                href={href}
                                onClick={onClose}
                                className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5"
                            >
                                <img
                                    src={coverUrl(item)}
                                    alt=""
                                    className="h-16 w-12 rounded-lg object-cover"
                                />
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">{item.title}</p>
                                    <p className="truncate text-xs text-zinc-400">
                                        {[item.videoCategoryLabel, item.streamer?.name].filter(Boolean).join(" · ")}
                                    </p>
                                </div>
                            </LocaleLink>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

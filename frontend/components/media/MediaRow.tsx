"use client";

import { memo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import EventCard from "./EventCard";
import type { MediaItem } from "@/lib/media";
import { useT } from "@/lib/i18n/I18nProvider";

function MediaRow({
    title,
    items,
    hrefFor,
    wide,
    hoverPreview,
}: {
    title: string;
    items: MediaItem[];
    hrefFor?: (item: MediaItem) => string;
    wide?: boolean;
    hoverPreview?: boolean;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    const { t } = useT();

    const scroll = useCallback((dir: number) => {
        scroller.current?.scrollBy({ left: dir * 640, behavior: "smooth" });
    }, []);

    if (!items.length) return null;

    return (
        <section className="relative mb-8 md:mb-10">
            <h2 className="mb-3 px-4 text-lg font-bold tracking-tight text-white md:px-10 md:text-xl">{title}</h2>
            <div className="group/row relative">
                <button
                    type="button"
                    className="absolute left-0 top-0 z-10 hidden h-full w-10 items-center justify-center bg-gradient-to-r from-background to-transparent opacity-0 transition group-hover/row:opacity-100 md:flex"
                    onClick={() => scroll(-1)}
                    aria-label={t("media.prev")}
                >
                    <ChevronLeft className="size-8" />
                </button>
                <div
                    ref={scroller}
                    data-home-row=""
                    className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-6 pt-2 md:gap-4 md:px-10"
                >
                    {items.map((item) => (
                        <EventCard
                            key={item.id || item.showId}
                            item={item}
                            href={hrefFor?.(item)}
                            wide={wide}
                            hoverPreview={hoverPreview}
                        />
                    ))}
                </div>
                <button
                    type="button"
                    className="absolute right-0 top-0 z-10 hidden h-full w-10 items-center justify-center bg-gradient-to-l from-background to-transparent opacity-0 transition group-hover/row:opacity-100 md:flex"
                    onClick={() => scroll(1)}
                    aria-label={t("media.next")}
                >
                    <ChevronRight className="size-8" />
                </button>
            </div>
        </section>
    );
}

export default memo(MediaRow);

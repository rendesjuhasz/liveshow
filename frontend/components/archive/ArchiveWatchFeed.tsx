"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiFetch } from "@/api/http";
import { useT } from "@/lib/i18n/I18nProvider";
import { withLocalePrefix } from "@/lib/i18n/paths";
import { warmArchivePlayback } from "@/lib/archive-src-cache";
import ArchiveWatchSlide, { type ArchiveListed } from "@/components/archive/ArchiveWatchSlide";

export default function ArchiveWatchFeed({ initialId }: { initialId: string }) {
    const { t, locale } = useT();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const didSnapRef = useRef(false);
    const [ids, setIds] = useState<string[]>([initialId]);
    const [listed, setListed] = useState<Record<string, ArchiveListed>>({});
    const [activeId, setActiveId] = useState(initialId);
    const [phoneLandscape, setPhoneLandscape] = useState(false);

    useLayoutEffect(() => {
        document.documentElement.setAttribute("data-live-watch", "1");
        return () => document.documentElement.removeAttribute("data-live-watch");
    }, []);

    useEffect(() => {
        const check = () => {
            const phone = window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches;
            setPhoneLandscape(phone && window.innerWidth > window.innerHeight);
        };
        check();
        window.addEventListener("resize", check);
        window.addEventListener("orientationchange", check);
        return () => {
            window.removeEventListener("resize", check);
            window.removeEventListener("orientationchange", check);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        apiFetch("/archives?sort=newest")
            .then((data) => {
                if (cancelled) return;
                const map: Record<string, ArchiveListed> = {};
                const nextIds = (Array.isArray(data) ? data : []).map((row: any) => {
                    const showId = String(row.showId || row.id);
                    map[showId] = {
                        showId,
                        title: row.title,
                        streamer: row.streamer || null,
                        description: row.description || null,
                        image: row.image || null,
                        streamId: row.streamId || null,
                        publicPath: row.publicPath || null,
                    };
                    return showId;
                });
                if (initialId && !nextIds.includes(initialId)) nextIds.unshift(initialId);
                setListed(map);
                setIds(nextIds.length ? nextIds : [initialId]);
            })
            .catch(() => {
                if (!cancelled) setIds([initialId]);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const index = Math.max(0, ids.indexOf(activeId));

    useEffect(() => {
        for (let i = Math.max(0, index - 2); i <= Math.min(ids.length - 1, index + 2); i += 1) {
            const id = ids[i];
            const row = listed[id];
            void warmArchivePlayback(id, row?.streamId, row?.publicPath);
        }
    }, [ids, index, listed]);

    useLayoutEffect(() => {
        if (didSnapRef.current) return;
        const root = scrollerRef.current;
        const node = root?.querySelector(`[data-archive-slide="${initialId}"]`);
        if (!node) return;
        node.scrollIntoView({ block: "start" });
        setActiveId(initialId);
        didSnapRef.current = true;
    }, [ids, initialId]);

    useEffect(() => {
        const path = withLocalePrefix(`/archive/${activeId}`, locale);
        if (window.location.pathname === path) return;
        window.history.replaceState(window.history.state, "", path);
    }, [activeId, locale]);

    useEffect(() => {
        const root = scrollerRef.current;
        if (!root) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.45)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                const id = (visible?.target as HTMLElement | undefined)?.dataset.archiveSlide;
                if (id && didSnapRef.current) setActiveId(id);
            },
            { root, threshold: [0.45, 0.6, 0.8] },
        );
        root.querySelectorAll("[data-archive-slide]").forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [ids]);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "ArrowDown" || event.key === "PageDown") {
                event.preventDefault();
                const next = ids[index + 1];
                if (!next) return;
                scrollerRef.current?.querySelector(`[data-archive-slide="${next}"]`)?.scrollIntoView({
                    block: "start",
                    behavior: "smooth",
                });
            }
            if (event.key === "ArrowUp" || event.key === "PageUp") {
                event.preventDefault();
                const prev = ids[index - 1];
                if (!prev) return;
                scrollerRef.current?.querySelector(`[data-archive-slide="${prev}"]`)?.scrollIntoView({
                    block: "start",
                    behavior: "smooth",
                });
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [ids, index]);

    return (
        <div data-live-viewer className="fixed inset-0 z-[80] bg-black">
            {phoneLandscape ? (
                <div className="flex h-dvh items-center justify-center px-6 text-center text-white">
                    <p className="text-base font-semibold">{t("archive.rotate")}</p>
                </div>
            ) : (
                <div
                    ref={scrollerRef}
                    className="h-dvh w-full overflow-y-auto overscroll-none snap-y snap-mandatory"
                >
                    {ids.map((id, i) => (
                        <section
                            key={id}
                            data-archive-slide={id}
                            className="h-dvh w-full snap-start snap-always"
                        >
                            {Math.abs(i - index) <= 2 ? (
                                <ArchiveWatchSlide showId={id} active={id === activeId} listed={listed[id]} />
                            ) : (
                                <div className="h-dvh bg-black" />
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

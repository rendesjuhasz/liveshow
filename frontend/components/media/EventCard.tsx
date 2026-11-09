"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, Play, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { coverUrl, isEndedShow, mediaId, watchHref, type MediaItem } from "@/lib/media";
import { formatCount } from "@/lib/views";
import { useT } from "@/lib/i18n/I18nProvider";
import { useEventCountdown } from "@/hooks/useEventCountdown";
import type { EventCountdown } from "@/lib/event-countdown";
import { isFavorite, toggleFavorite } from "@/lib/library";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/api/http";
import OriginalLanguageBadge from "@/components/OriginalLanguageBadge";
import {
    PREVIEW_CLIP_SEC,
    PREVIEW_HOVER_MS,
    canHoverPreview,
    claimPreviewSlot,
    previewMediaSrc,
    previewStartFraction,
    releasePreviewSlot,
} from "@/lib/archive-hover";

function EventCard({
    item,
    href,
    wide = false,
    hoverPreview = false,
}: {
    item: MediaItem;
    href?: string;
    wide?: boolean;
    hoverPreview?: boolean;
}) {
    const { user } = useAuth();
    const { t, locale } = useT();
    const id = mediaId(item);
    const to = href || watchHref(item);
    const ended = isEndedShow(item);
    const countdown = useEventCountdown(item.live || ended ? { ended: true } : item);
    const [fav, setFav] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hoverTimer = useRef<number | null>(null);
    const fetchAbort = useRef<AbortController | null>(null);
    const clip = useRef({ start: 0, end: 0 });

    useEffect(() => {
        setFav(isFavorite(id, user?.id));
    }, [id, user?.id]);

    function clearHoverTimer() {
        if (hoverTimer.current) {
            window.clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
    }

    function stopPreview() {
        clearHoverTimer();
        fetchAbort.current?.abort();
        fetchAbort.current = null;
        const video = videoRef.current;
        if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load();
        }
        setPreviewing(false);
        releasePreviewSlot(stopPreview);
    }

    async function startPreview() {
        if (!hoverPreview || !id || item.exists === false) return;
        if (!canHoverPreview()) return;
        claimPreviewSlot(stopPreview);
        const ac = new AbortController();
        fetchAbort.current = ac;
        try {
            const data = await apiFetch(`/archives/${encodeURIComponent(id)}/preview`, {
                signal: ac.signal,
            } as RequestInit);
            if (!data?.url || ac.signal.aborted) return;
            const video = videoRef.current;
            if (!video) return;
            video.muted = true;
            video.defaultMuted = true;
            video.src = previewMediaSrc(String(data.url));
            video.preload = "auto";
            const onMeta = () => {
                video.removeEventListener("loadedmetadata", onMeta);
                const duration = Number(video.duration) || 0;
                const clipLen = Math.min(PREVIEW_CLIP_SEC, data.clipSeconds || PREVIEW_CLIP_SEC);
                if (data.hasTeaser || duration <= clipLen + 1) {
                    clip.current = { start: 0, end: duration || clipLen };
                } else {
                    const start = duration * previewStartFraction(id);
                    clip.current = { start, end: Math.min(duration, start + clipLen) };
                    video.currentTime = start;
                }
                video.play().catch(() => undefined);
                setPreviewing(true);
            };
            video.addEventListener("loadedmetadata", onMeta);
        } catch {
            if (ac.signal.aborted) return;
            setPreviewing(false);
        }
    }

    function onEnter() {
        if (!hoverPreview || !canHoverPreview()) return;
        clearHoverTimer();
        hoverTimer.current = window.setTimeout(() => {
            void startPreview();
        }, PREVIEW_HOVER_MS);
    }

    function onLeave() {
        stopPreview();
    }

    useEffect(() => {
        return () => stopPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    return (
        <motion.div
            className={cn(
                "group relative shrink-0 snap-start",
                wide
                    ? "w-[min(18rem,calc(100vw-2rem))] sm:w-[340px]"
                    : "w-[min(10.75rem,calc(50vw-1.5rem))] sm:w-[180px] md:w-[200px]",
            )}
            initial={false}
            whileHover={{ scale: 1.03, zIndex: 20 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >
            <Link href={to} className="block">
                <div
                    className={cn(
                        "relative overflow-hidden rounded-2xl bg-card shadow-[0_10px_28px_rgba(0,0,0,0.4)] transition-shadow duration-200 group-hover:shadow-[0_12px_36px_rgba(77,203,255,0.15)]",
                        wide ? "aspect-video" : "aspect-[2/3]",
                        item.live && "ring-2 ring-live shadow-[0_10px_32px_rgba(255,59,48,0.28)]",
                        ended && "ring-1 ring-white/10",
                    )}
                >
                    <img
                        src={coverUrl(item)}
                        alt={item.title || ""}
                        className="h-full w-full object-cover transition duration-500 group-hover:brightness-110"
                    />
                    {hoverPreview && (
                        <video
                            ref={videoRef}
                            className={cn(
                                "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                                previewing ? "opacity-100" : "opacity-0",
                            )}
                            muted
                            playsInline
                            loop={false}
                            disablePictureInPicture
                            preload="none"
                            onTimeUpdate={(e) => {
                                const video = e.currentTarget;
                                if (clip.current.end && video.currentTime >= clip.current.end - 0.05) {
                                    video.currentTime = clip.current.start;
                                }
                            }}
                        />
                    )}
                    <div
                        className={cn(
                            "absolute inset-0 z-[1] bg-gradient-to-t to-transparent opacity-80",
                            ended ? "from-[#151515] via-[#151515]/50" : "from-black via-black/25",
                        )}
                    />
                    <div className="absolute left-2 top-2 z-[2] flex max-w-[calc(100%-3.25rem)] flex-wrap gap-1">
                        {item.live ? (
                            <span className="rounded-md bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-[0_4px_12px_rgba(255,59,48,0.45)]">
                                {t("media.live")}
                            </span>
                        ) : item.scheduleStatus === "delayed" ? (
                            <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                                {t("media.delayed")}
                            </span>
                        ) : item.videoCategoryLabel ? (
                            <span className="truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                {item.videoCategoryLabel}
                            </span>
                        ) : null}
                    </div>
                    <div
                        className={cn(
                            "absolute inset-0 z-[1] flex items-center justify-center transition",
                            previewing ? "opacity-0" : "opacity-0 group-hover:opacity-100",
                        )}
                    >
                        <span className="flex size-12 items-center justify-center rounded-full bg-white/95 text-black shadow-xl">
                            <Play className="ml-0.5 size-5 fill-current" />
                        </span>
                    </div>
                    <div className={cn("absolute inset-x-0 bottom-0 z-[2]", wide ? "p-3" : "p-2 sm:p-2.5")}>
                        <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                            <OriginalLanguageBadge
                                originalLocale={item.originalLocale}
                                contentTranslated={item.contentTranslated}
                            />
                            <span className="line-clamp-1">{item.title}</span>
                        </p>
                        <EventCardMeta
                            live={Boolean(item.live)}
                            ended={ended}
                            delayed={item.scheduleStatus === "delayed"}
                            countdown={countdown}
                            viewerCount={item.viewerCount}
                            viewCount={item.viewCount}
                            t={t}
                            locale={locale}
                        />
                    </div>
                </div>
            </Link>
            <button
                type="button"
                aria-label={fav ? t("media.favoriteRemove") : t("media.favoriteAdd")}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-2 opacity-100 backdrop-blur-md transition sm:opacity-0 sm:group-hover:opacity-100 sm:p-1.5"
                onClick={(e) => {
                    e.preventDefault();
                    setFav(toggleFavorite(item, user?.id));
                }}
            >
                <Heart className={cn("size-4", fav ? "fill-accent text-accent" : "text-white")} />
            </button>
        </motion.div>
    );
}

function EventCardMeta({
    live,
    ended,
    delayed,
    countdown,
    viewerCount,
    viewCount,
    t,
    locale,
}: {
    live: boolean;
    ended: boolean;
    delayed?: boolean;
    countdown: EventCountdown | null;
    viewerCount?: number;
    viewCount?: number;
    t: (key: string) => string;
    locale: string;
}) {
    if (live) {
        return (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-semibold text-white sm:text-[11px]">
                <Eye className="size-3.5 shrink-0 text-accent" aria-hidden />
                {t("media.viewers").replace("{n}", formatCount(viewerCount, locale))}
            </p>
        );
    }
    if (delayed) {
        return (
            <p className="mt-1 truncate text-[10px] font-semibold text-amber-400 sm:text-[11px]">
                {t("media.delayed")}
            </p>
        );
    }
    if (ended) {
        return (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-medium text-muted sm:text-[11px]">
                <Eye className="size-3.5 shrink-0" aria-hidden />
                {t("media.views").replace("{n}", formatCount(viewCount, locale))}
            </p>
        );
    }
    if (!countdown) return null;
    return (
        <p
            className={cn(
                "mt-1 truncate text-[10px] font-medium tabular-nums tracking-tight sm:text-[11px]",
                countdown.live ? "text-live" : "text-muted",
            )}
        >
            {countdown.label}
        </p>
    );
}

export default memo(EventCard);

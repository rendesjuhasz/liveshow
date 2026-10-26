"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Star, X } from "lucide-react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { recordWatched } from "@/lib/library";
import { loadArchiveInfo, peekArchiveInfo, peekArchiveSrc, warmArchivePlayback } from "@/lib/archive-src-cache";
import ReviewForm from "@/components/ReviewForm";
import CreatorPublicLinks from "@/components/CreatorPublicLinks";
import ViewerReactionBar from "@/components/ViewerReactionBar";
import { formatCount } from "@/lib/views";
import { useT } from "@/lib/i18n/I18nProvider";

export type ArchiveListed = {
    showId: string;
    title?: string;
    streamer?: string | null;
    description?: string | null;
    image?: string | null;
    streamId?: string | null;
    publicPath?: string | null;
};

export default function ArchiveWatchSlide({
    showId,
    active,
    listed,
}: {
    showId: string;
    active: boolean;
    listed?: ArchiveListed;
}) {
    const { user } = useAuth();
    const { t } = useT();
    const videoRef = useRef<HTMLVideoElement>(null);
    const countedRef = useRef(false);
    const watchedRef = useRef(false);
    const [info, setInfo] = useState<any>(() => peekArchiveInfo(showId));
    const [src, setSrc] = useState(() => peekArchiveSrc(showId));
    const [error, setError] = useState("");
    const [viewCount, setViewCount] = useState(Number(info?.viewCount) || 0);
    const [reviewsOpen, setReviewsOpen] = useState(false);
    const [dialogReady, setDialogReady] = useState(false);

    useEffect(() => {
        setDialogReady(true);
    }, []);

    useEffect(() => {
        countedRef.current = false;
        watchedRef.current = false;
        setError("");
        const cachedSrc = peekArchiveSrc(showId);
        const cachedInfo = peekArchiveInfo(showId);
        if (cachedSrc) setSrc(cachedSrc);
        if (cachedInfo) {
            setInfo(cachedInfo);
            setViewCount(Number(cachedInfo?.viewCount) || 0);
        }
        const streamId = listed?.streamId || cachedInfo?.streamId;
        warmArchivePlayback(showId, streamId, listed?.publicPath || cachedInfo?.publicPath)
            .then((url) => setSrc(url))
            .catch((err: any) => setError(err.message || "Nem sikerült elindítani a lejátszást."));
        loadArchiveInfo(showId)
            .then((data) => {
                setInfo(data);
                setViewCount(Number(data?.viewCount) || 0);
                if (!streamId && data?.streamId) {
                    return warmArchivePlayback(showId, data.streamId, data.publicPath).then((url) => setSrc(url));
                }
            })
            .catch((err: any) => setError(err.message || t("archive.unknownCat")));
    }, [showId, listed?.streamId, listed?.publicPath, t]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;
        if (active) {
            video.muted = false;
            const play = video.play();
            if (play) {
                play.catch(() => {
                    video.muted = true;
                    video.play().catch(() => undefined);
                });
            }
            if (!watchedRef.current) {
                watchedRef.current = true;
                recordWatched(
                    { id: String(showId), title: info?.title || listed?.title, image: info?.image || listed?.image },
                    user?.id,
                );
            }
        } else {
            video.pause();
            video.muted = true;
        }
    }, [active, src, showId, info?.title, info?.image, listed?.title, listed?.image, user?.id]);

    const title = info?.title || listed?.title || t("archive.heading");
    const categoryLabel =
        info?.videoCategoryLabel ||
        (info?.videoCategory ? t(`cat.${info.videoCategory}`) : "");
    const creator = info?.creatorLinks?.name || listed?.streamer || "";
    const description = String(info?.description || listed?.description || "").trim();

    return (
        <article className="relative h-dvh w-full overflow-hidden bg-black text-white">
            <div className="absolute inset-0 overflow-hidden bg-black">
                {src ? (
                    <video
                        ref={videoRef}
                        src={src}
                        controls
                        playsInline
                        loop
                        preload="auto"
                        className="absolute inset-0 z-0 h-full w-full max-w-none bg-black object-cover"
                        style={{ touchAction: "pan-y" }}
                        onTimeUpdate={(e) => {
                            const video = e.currentTarget;
                            const seconds = Number(video.currentTime) || 0;
                            const duration = Number(video.duration) || 0;
                            if (countedRef.current || !showId || !user) return;
                            const enoughTime = seconds >= 10;
                            const enoughShare = duration >= 8 && seconds / duration >= 0.2;
                            if (!enoughTime && !enoughShare) return;
                            countedRef.current = true;
                            apiFetch("/views/archive", {
                                method: "POST",
                                body: JSON.stringify({
                                    showId: String(showId),
                                    seconds,
                                    duration,
                                }),
                            })
                                .then((res) => {
                                    if (typeof res?.viewCount === "number") setViewCount(res.viewCount);
                                })
                                .catch(() => {
                                    countedRef.current = false;
                                });
                        }}
                    />
                ) : (
                    <p className="pointer-events-none absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-white/50">
                        {error || t("common.loading")}
                    </p>
                )}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-14 z-[90] bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pr-16 pt-16">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-white/85">
                    <Eye className="size-3.5" aria-hidden />
                    {formatCount(viewCount)}
                    {categoryLabel ? <span className="uppercase tracking-wide text-[#25f4ee]">{categoryLabel}</span> : null}
                </p>
                <h1 className="mb-1 text-base font-bold leading-tight">{title}</h1>
                {creator ? <p className="mb-1 text-sm font-semibold text-white/90">@{creator}</p> : null}
                {description ? <p className="mb-2 line-clamp-3 text-sm text-white/80">{description}</p> : null}
                <div className="pointer-events-auto max-w-[min(100%,22rem)]">
                    <CreatorPublicLinks name={info?.creatorLinks?.name} links={info?.creatorLinks?.links} />
                </div>
            </div>

            <div className="absolute bottom-36 right-3 z-[200] flex flex-col items-end gap-2">
                <ViewerReactionBar inline shareKind="archive" shareId={String(showId)} />
                <button
                    type="button"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl active:scale-95"
                    aria-label={t("review.title")}
                    onClick={() => setReviewsOpen(true)}
                >
                    <Star className="size-5" aria-hidden />
                </button>
            </div>

            {dialogReady && reviewsOpen
                ? createPortal(
                      <dialog
                          open
                          className="viewer-share-dialog"
                          onClose={() => setReviewsOpen(false)}
                          onCancel={(event) => {
                              event.preventDefault();
                              setReviewsOpen(false);
                          }}
                      >
                          <div className="mb-3 flex items-center justify-between">
                              <h2 className="text-lg font-bold text-white">{t("review.title")}</h2>
                              <button
                                  type="button"
                                  className="flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                                  aria-label={t("share.close")}
                                  onClick={() => setReviewsOpen(false)}
                              >
                                  <X className="size-5" />
                              </button>
                          </div>
                          <div className="max-h-[70vh] overflow-y-auto [&_section]:mt-0">
                              <ReviewForm showId={String(showId)} />
                          </div>
                      </dialog>,
                      document.body,
                  )
                : null}
        </article>
    );
}

"use client";

import { memo, useEffect, useRef, useState } from "react";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { apiFetch, publicAssetUrl } from "@/api/http";
import { isPlaceholderStreamId } from "@/lib/getStreamToken";
import { recordWatched } from "@/lib/library";
import Player from "./Player";
import WatchFeedbackPrompt from "@/components/WatchFeedbackPrompt";
import LiveChat from "@/components/LiveChat";
import ReviewForm from "@/components/ReviewForm";
import { Eye } from "lucide-react";
import { formatCount } from "@/lib/views";
import { useT } from "@/lib/i18n/I18nProvider";
import LocaleLink from "@/components/LocaleLink";
import { useMounted } from "@/lib/use-mounted";

type LiveWatchScreenProps = {
    showId: string;
};

const FREE_LIVE_ACCESS = {
    live: true,
    archive: true,
    questions: false,
    extras: false,
    privateStream: false,
};

function LiveBootShell() {
    return (
        <div data-live-viewer className="relative flex h-dvh items-center justify-center bg-black text-white">
            <p className="text-sm text-white/70">Betöltés...</p>
        </div>
    );
}

function LiveWatchScreen({ showId }: LiveWatchScreenProps) {
    const { user, ready } = useAuth();
    const { t } = useT();
    const mounted = useMounted();
    const [title, setTitle] = useState("");
    const [categoryLabel, setCategoryLabel] = useState("");
    const [streamId, setStreamId] = useState("");
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);
    const [access, setAccess] = useState<any>(FREE_LIVE_ACCESS);
    const [extras, setExtras] = useState("");
    const [privateStreamId, setPrivateStreamId] = useState("");
    const [error, setError] = useState("");
    const [ownShow, setOwnShow] = useState(false);
    const [showLive, setShowLive] = useState(true);
    const [viewerCount, setViewerCount] = useState(0);
    const [onAirQuestion, setOnAirQuestion] = useState("");
    const [host, setHost] = useState<{ id?: string; name?: string; avatarUrl?: string | null } | null>(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [webrtcLive, setWebrtcLive] = useState(false);
    const prevLive = useRef<boolean | null>(null);
    const sawBroadcast = useRef(false);
    const offeredFeedback = useRef(false);
    const ownShowRef = useRef(ownShow);
    ownShowRef.current = ownShow;

    function offerWatchFeedback() {
        if (ownShowRef.current || offeredFeedback.current) return;
        offeredFeedback.current = true;
        setFeedbackOpen(true);
    }

    useEffect(() => {
        let cancelled = false;
        async function loadShow() {
            try {
                const show = await apiFetch(`/shows/${encodeURIComponent(showId)}`);
                if (cancelled) return;
                applyShow(show);
            } catch {
                /* a boot / poll újrapróbálja */
            }
        }
        loadShow();
        return () => {
            cancelled = true;
        };
    }, [showId, t]);

    function applyShow(show: any) {
        if (!show) return;
        setTitle(show?.title || t("live.title"));
        setCategoryLabel(show?.videoCategoryLabel || "");
        setStreamId(typeof show?.streamId === "string" ? show.streamId.trim() : "");
        setStreamUrl(show?.streamUrl ?? null);
        setOwnShow(Boolean(user?.streamer?.id && show?.streamer?.id === user.streamer.id));
        setShowLive(Boolean(show?.live));
        setViewerCount(Number(show?.viewerCount) || 0);
        setHost({
            id: typeof show?.streamer?.id === "string" ? show.streamer.id : "",
            name: String(show?.streamer?.name || "").trim() || "Előadó",
            avatarUrl: show?.streamer?.avatarUrl || null,
        });
    }

    useEffect(() => {
        if (!ready) return;

        let cancelled = false;

        async function boot() {
            try {
                const show = await apiFetch(`/shows/${encodeURIComponent(showId)}`);
                if (cancelled) return;
                applyShow(show);
            } catch (err: any) {
                if (cancelled) return;
                setError(
                    err.message ||
                        "A közvetítés most nem tölthető be. Próbáld újra később.",
                );
                setChecking(false);
                return;
            }

            if (!user) {
                setAccess(FREE_LIVE_ACCESS);
                setChecking(false);
                return;
            }

            if (isAdmin(user)) {
                setAccess({
                    live: true,
                    archive: true,
                    questions: true,
                    extras: true,
                    privateStream: true,
                });
                setChecking(false);
                return;
            }

            try {
                const data = await apiFetch(`/tickets/show/${showId}`);
                if (cancelled) return;
                setAccess({
                    ...FREE_LIVE_ACCESS,
                    ...(data?.access || {}),
                    live: true,
                });
                setExtras(data?.extrasContent || "");
                setPrivateStreamId(data?.privateStreamId || "");
            } catch {
                if (cancelled) return;
                setAccess(FREE_LIVE_ACCESS);
            } finally {
                if (!cancelled) setChecking(false);
            }
        }

        boot();
        return () => {
            cancelled = true;
        };
    }, [ready, user, showId]);

    useEffect(() => {
        if (!showId) return;
        let cancelled = false;
        async function poll() {
            try {
                const [show, data] = await Promise.all([
                    apiFetch(`/shows/${encodeURIComponent(showId)}`).catch(() => null),
                    apiFetch(`/views/live/${encodeURIComponent(showId)}`).catch(() => null),
                ]);
                if (cancelled) return;
                if (show) applyShow(show);
                if (data) setViewerCount(Number(data?.viewerCount) || 0);
            } catch {
                /* a nézőszám a következő körben újrapróbál */
            }
        }
        poll();
        const t = window.setInterval(poll, 4_000);
        return () => {
            cancelled = true;
            window.clearInterval(t);
        };
    }, [showId]);

    useEffect(() => {
        if (checking) return;
        if (showLive) sawBroadcast.current = true;
        const prev = prevLive.current;
        prevLive.current = showLive;
        if (prev === true && !showLive) offerWatchFeedback();
    }, [checking, showLive]);

    useEffect(() => {
        if (checking) return;
        if (showLive || webrtcLive) {
            sawBroadcast.current = true;
            return;
        }
        if (!sawBroadcast.current) return;
        const timer = window.setTimeout(() => offerWatchFeedback(), 2500);
        return () => window.clearTimeout(timer);
    }, [checking, showLive, webrtcLive]);

    useEffect(() => {
        if (!showId) return;
        let cancelled = false;
        async function pollQuestion() {
            try {
                const qs = await apiFetch(`/questions?showId=${encodeURIComponent(showId)}`);
                if (cancelled) return;
                setOnAirQuestion(typeof qs?.current?.text === "string" ? qs.current.text.trim() : "");
            } catch {
                /* a kérdésfelirat a következő körben újrapróbál */
            }
        }
        pollQuestion();
        const t = window.setInterval(pollQuestion, 4000);
        return () => {
            cancelled = true;
            window.clearInterval(t);
        };
    }, [showId]);

    useEffect(() => {
        if (!user || !showId || !streamId) return;
        recordWatched({ id: showId, title }, user?.id);
    }, [user, showId, streamId, title]);

    if (!mounted) {
        return <LiveBootShell />;
    }

    if (!ready || checking) {
        return (
            <div data-live-viewer className="relative flex h-dvh items-center justify-center bg-black text-white">
                <LiveTopBar live viewers={viewerCount} title={title} categoryLabel={categoryLabel} host={host} onAirQuestion={onAirQuestion} />
                <p className="text-sm text-white/70">{t("common.loading")}</p>
            </div>
        );
    }

    if (error && !streamId) {
        return (
            <div data-live-viewer className="relative flex h-dvh flex-col items-center justify-center bg-black px-6 text-center text-white">
                <LiveTopBar live={false} viewers={viewerCount} title={title} categoryLabel={categoryLabel} host={host} onAirQuestion={onAirQuestion} />
                <p className="mb-2 text-sm text-red-400">{error}</p>
                <p className="text-sm text-white/55">{t("live.loadHint")}</p>
            </div>
        );
    }

    if (!streamId || isPlaceholderStreamId(streamId)) {
        return (
            <div data-live-viewer className="relative flex h-dvh flex-col items-center justify-center bg-black px-6 text-center text-white">
                <LiveTopBar live={false} viewers={viewerCount} title={title} categoryLabel={categoryLabel} host={host} onAirQuestion={onAirQuestion} />
                <p className="text-sm text-white/70">{t("live.noStream")}</p>
            </div>
        );
    }

    return (
        <div data-live-viewer className="bg-black text-white">
            <div className="relative h-dvh overflow-hidden">
                <div className="absolute inset-0 min-w-0">
                    <Player
                        showId={showId}
                        streamId={streamId}
                        streamUrl={streamUrl}
                        purpose="live"
                        liveControls={showLive}
                        ownShow={ownShow}
                        onBroadcastLive={setWebrtcLive}
                        onBroadcastEnded={() => {
                            sawBroadcast.current = true;
                            offerWatchFeedback();
                        }}
                    />
                </div>
                <LiveTopBar
                    live={showLive || webrtcLive}
                    viewers={viewerCount}
                    title={title}
                    categoryLabel={categoryLabel}
                    host={host}
                    onAirQuestion={onAirQuestion}
                />
                {ownShow && (
                    <p className="absolute left-3 top-[calc(5.5rem+env(safe-area-inset-top))] z-40 mb-0 max-w-[min(72%,20rem)] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs shadow-[0_8px_20px_rgba(0,0,0,0.25)] backdrop-blur-md">
                        {t("live.ownShow")}
                    </p>
                )}
                <aside
                    data-live-chat-overlay
                    className="live-watch-overlay absolute inset-x-0 bottom-0 z-40 max-h-[min(38vh,20rem)] overflow-y-auto px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pr-16 md:left-3 md:right-auto md:w-[min(22rem,calc(100%-6rem))] md:pr-3"
                >
                    <LiveChat showId={showId} live={showLive} />
                    {!showLive && !ownShow && (
                        <div className="mt-4">
                            <ReviewForm showId={showId} />
                        </div>
                    )}
                </aside>
            </div>
            {access?.privateStream && privateStreamId && (
                <div className="space-y-2 p-4">
                    <h2 className="mb-2 text-xl font-semibold">{t("live.vipPrivate")}</h2>
                    <Player showId={showId} streamId={privateStreamId} purpose="private" />
                </div>
            )}
            {access?.extras && extras && (
                <div className="m-4 whitespace-pre-wrap rounded-xl border border-white/15 bg-black/50 p-4 backdrop-blur-md">
                    <h2 className="mb-2 text-xl font-semibold">{t("live.vipExtras")}</h2>
                    <p>{extras}</p>
                </div>
            )}
            {access?.extras && !extras && (
                <p className="p-4 text-white/55">{t("live.vipEmpty")}</p>
            )}
            <WatchFeedbackPrompt showId={showId} open={feedbackOpen && !ownShow} onClose={() => setFeedbackOpen(false)} />
        </div>
    );
}

function LiveTopBar({
    live,
    viewers,
    title,
    categoryLabel,
    host,
    onAirQuestion = "",
}: {
    live: boolean;
    viewers: number;
    title: string;
    categoryLabel: string;
    host: { id?: string; name?: string; avatarUrl?: string | null } | null;
    onAirQuestion?: string;
}) {
    return (
        <div className="pointer-events-none absolute inset-x-2 top-[calc(0.75rem+env(safe-area-inset-top))] z-[210] flex items-start gap-2 sm:inset-x-3">
            <p className="mb-0 flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/70 py-1 pl-1 pr-2 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:pr-2.5 md:text-sm">
                {live ? (
                    <span className="rounded-full bg-[#fe2c55] px-2 py-0.5 text-[10px] font-black tracking-wide">ÉLŐ</span>
                ) : null}
                <Eye className="size-4 text-white/85" aria-hidden />
                {formatCount(viewers)}
            </p>
            <div className="flex min-w-0 max-w-[min(72vw,36rem)] flex-col gap-1 sm:max-w-[min(56vw,40rem)]">
                <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-full border border-white/20 bg-black/75 px-2.5 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-3">
                    {title ? (
                        <h1 className="mb-0 min-w-0 truncate text-xs font-bold leading-tight sm:text-sm md:text-base">
                            {title}
                        </h1>
                    ) : null}
                    {categoryLabel ? (
                        <p className="mb-0 min-w-0 shrink truncate text-[10px] font-semibold uppercase tracking-wide text-[#25f4ee] sm:text-[11px]">
                            {categoryLabel}
                        </p>
                    ) : null}
                </div>
                {onAirQuestion ? (
                    <p className="mb-0 line-clamp-2 rounded-xl border border-white/20 bg-black/75 px-2.5 py-1.5 text-xs font-semibold leading-snug text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:text-sm">
                        {onAirQuestion}
                    </p>
                ) : null}
            </div>
            <div className="pointer-events-auto ml-auto shrink-0">
                <HostChip host={host} />
            </div>
        </div>
    );
}

function HostChip({
    host,
}: {
    host: { id?: string; name?: string; avatarUrl?: string | null } | null;
}) {
    const [imgOk, setImgOk] = useState(true);
    useEffect(() => {
        setImgOk(true);
    }, [host?.avatarUrl]);
    const name = host?.name?.trim();
    if (!name) return null;
    const photo = Boolean(host?.avatarUrl && imgOk);
    return (
        <LocaleLink
            href={host?.id ? `/streamers/${host.id}` : "/streamers"}
            aria-label={name}
            className="pointer-events-auto flex max-w-[7.5rem] items-center gap-2 rounded-full border border-white/20 bg-black/70 py-1 pl-1 pr-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:max-w-[14rem]"
        >
            {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={publicAssetUrl(host?.avatarUrl)}
                    alt=""
                    className="size-8 shrink-0 rounded-full object-cover"
                    onError={() => setImgOk(false)}
                />
            ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#fe2c55] text-sm font-bold">
                    {name.charAt(0).toUpperCase()}
                </span>
            )}
            <span className="truncate text-sm font-semibold">{name}</span>
        </LocaleLink>
    );
}

export default memo(LiveWatchScreen);

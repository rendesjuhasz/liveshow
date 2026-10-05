"use client";

import { memo, useEffect, useState } from "react";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/api/http";
import { isPlaceholderStreamId } from "@/lib/getStreamToken";
import { recordWatched } from "@/lib/library";
import Player from "./Player";
import ShowTalk from "./ShowTalk";
import LiveChat from "@/components/LiveChat";
import ReviewForm from "@/components/ReviewForm";
import { Eye } from "lucide-react";
import { formatCount } from "@/lib/views";
import { useT } from "@/lib/i18n/I18nProvider";

type LiveViewerProps = {
    showId: string;
};

const FREE_LIVE_ACCESS = {
    live: true,
    archive: true,
    questions: false,
    extras: false,
    privateStream: false,
};

function LiveViewer({ showId }: LiveViewerProps) {
    const { user, ready } = useAuth();
    const { t } = useT();
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

    useEffect(() => {
        if (!ready) return;

        let cancelled = false;

        async function boot() {
            try {
                const show = await apiFetch(`/shows/${encodeURIComponent(showId)}`);
                if (cancelled) return;
                setTitle(show?.title || t("live.title"));
                setCategoryLabel(show?.videoCategoryLabel || "");
                setStreamId(typeof show?.streamId === "string" ? show.streamId.trim() : "");
                setStreamUrl(show?.streamUrl ?? null);
                setOwnShow(Boolean(user?.streamer?.id && show?.streamer?.id === user.streamer.id));
                setShowLive(Boolean(show?.live));
                setViewerCount(Number(show?.viewerCount) || 0);
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
                if (show && typeof show.live === "boolean") setShowLive(Boolean(show.live));
                if (data) setViewerCount(Number(data?.viewerCount) || 0);
            } catch {
                /* a nézőszám a következő körben újrapróbál */
            }
        }
        poll();
        const t = window.setInterval(poll, 20_000);
        return () => {
            cancelled = true;
            window.clearInterval(t);
        };
    }, [showId]);

    useEffect(() => {
        if (!user || !showId || !streamId) return;
        recordWatched({ id: showId, title }, user?.id);
    }, [user, showId, streamId, title]);

    if (!ready || checking) {
        return (
            <div className="px-4 py-10 text-white md:p-10">
                <h1>{title || t("live.title")}</h1>
                <p>{t("common.loading")}</p>
            </div>
        );
    }

    if (error && !streamId) {
        return (
            <div className="px-4 py-10 text-white md:p-10">
                <h1>{t("live.title")}</h1>
                <p className="mb-4 text-red-400">{error}</p>
                <p className="text-zinc-400">{t("live.loadHint")}</p>
            </div>
        );
    }

    if (!streamId || isPlaceholderStreamId(streamId)) {
        return (
            <div className="px-4 py-10 text-white md:p-10">
                <h1>{title}</h1>
                <p>{t("live.noStream")}</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-background p-3 text-white md:p-6">
            <h1 className="mb-2 text-xl font-bold break-words md:text-3xl">{title}</h1>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Eye className="size-4 text-accent" aria-hidden />
                {t("media.watchingNow").replace("{n}", formatCount(viewerCount))}
            </p>
            {categoryLabel && (
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">{categoryLabel}</p>
            )}
            {ownShow && (
                <p className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
                    {t("live.ownShow")}
                </p>
            )}
            <p className="mb-4 text-sm text-zinc-400">
                {t("live.watchFree")}
            </p>
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-4">
                    <Player showId={showId} streamId={streamId} streamUrl={streamUrl} purpose="live" />
                    {access?.privateStream && privateStreamId && (
                        <div>
                            <h2 className="text-xl font-semibold mb-2">{t("live.vipPrivate")}</h2>
                            <Player showId={showId} streamId={privateStreamId} purpose="private" />
                        </div>
                    )}
                    {access?.extras && extras && (
                        <div className="bg-neutral-900 p-4 rounded-xl whitespace-pre-wrap">
                            <h2 className="text-xl font-semibold mb-2">{t("live.vipExtras")}</h2>
                            <p>{extras}</p>
                        </div>
                    )}
                    {access?.extras && !extras && (
                        <p className="text-neutral-400">{t("live.vipEmpty")}</p>
                    )}
                </div>
                <aside className="lg:max-h-[min(85vh,900px)] lg:overflow-auto">
                    <ShowTalk
                        showId={showId}
                        ownShow={ownShow}
                        live={showLive}
                        canAsk={!ownShow && showLive}
                    />
                    <LiveChat showId={showId} live={showLive} />
                    {!showLive && !ownShow && (
                        <div className="mt-4">
                            <ReviewForm showId={showId} />
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default memo(LiveViewer);

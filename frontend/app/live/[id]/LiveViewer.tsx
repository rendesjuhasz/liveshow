"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/api/http";
import { isPlaceholderStreamId } from "@/lib/getStreamToken";
import { recordWatched } from "@/lib/library";
import Player from "./Player";
import ShowTalk from "./ShowTalk";
import ReviewForm from "@/components/ReviewForm";
import { Eye } from "lucide-react";
import { liveViewersLabel } from "@/lib/views";

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

export default function LiveViewer({ showId }: LiveViewerProps) {
    const { user, ready } = useAuth();
    const [title, setTitle] = useState("Élő adás");
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
                setTitle(show?.title || "Élő adás");
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
                        "A backend nem elérhető. Indítsd el a Nestet a 3200-as porton.",
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
                const data = await apiFetch(`/views/live/${encodeURIComponent(showId)}`);
                if (!cancelled) setViewerCount(Number(data?.viewerCount) || 0);
            } catch {
                /* a nézőszám a következő körben újrapróbál */
            }
        }
        poll();
        const t = window.setInterval(poll, 8000);
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
                <h1>{title}</h1>
                <p>Betöltés...</p>
            </div>
        );
    }

    if (error && !streamId) {
        return (
            <div className="px-4 py-10 text-white md:p-10">
                <h1>Élő adás</h1>
                <p className="mb-4 text-red-400">{error}</p>
                <p className="text-zinc-400">
                    A live oldal a backendet használja: <code>http://127.0.0.1:3200</code>.
                    A backend mappában futtasd: <code>npm run start:dev</code>
                </p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="px-4 py-10">
                <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
                {categoryLabel && <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-accent">{categoryLabel}</p>}
                <p className="mt-3 text-zinc-400">
                    Az élő adás megtekintése ingyenes. A lejátszáshoz jelentkezz be. Jegy csak a
                    kérdésekhez, a támogatáshoz és a prémium interakciókhoz kell.
                </p>
                <p className="mt-4 flex gap-4">
                    <Link href="/login" className="text-accent">
                        Bejelentkezés
                    </Link>
                    <Link href="/register" className="text-accent">
                        Regisztráció
                    </Link>
                </p>
            </div>
        );
    }

    if (!streamId || isPlaceholderStreamId(streamId)) {
        return (
            <div className="px-4 py-10 text-white md:p-10">
                <h1>{title}</h1>
                <p>Ehhez a műsorhoz nincs stream ID. Add meg adminban.</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-background p-3 text-white md:p-6">
            <h1 className="mb-2 text-xl font-bold break-words md:text-3xl">{title}</h1>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Eye className="size-4 text-accent" aria-hidden />
                {liveViewersLabel(viewerCount)}
            </p>
            {categoryLabel && (
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">{categoryLabel}</p>
            )}
            {ownShow && (
                <p className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
                    Ez a te adásod. Kérdést ide nézőként nem lehet küldeni. Hagyd ezt az ablakot
                    a streamernek (Aktuális kérdés), a nézőt nyisd <strong>privát ablakban új
                    nézői emaillel</strong> — ne a streamer fiókkal.
                </p>
            )}
            <p className="mb-4 text-sm text-zinc-400">
                A műsor szabadon nézhető. Jegy a kérdésbeküldéshez és a prémium interakciókhoz
                használható.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch">
                <div className="min-w-0 space-y-4">
                    <Player showId={showId} streamId={streamId} streamUrl={streamUrl} purpose="live" />
                    {access?.privateStream && privateStreamId && (
                        <div>
                            <h2 className="text-xl font-semibold mb-2">VIP privát stream</h2>
                            <Player showId={showId} streamId={privateStreamId} purpose="private" />
                        </div>
                    )}
                    {access?.extras && extras && (
                        <div className="bg-neutral-900 p-4 rounded-xl whitespace-pre-wrap">
                            <h2 className="text-xl font-semibold mb-2">VIP extra tartalom</h2>
                            <p>{extras}</p>
                        </div>
                    )}
                    {access?.extras && !extras && (
                        <p className="text-neutral-400">VIP extra tartalom: a streamer még nem töltött fel anyagot.</p>
                    )}
                </div>
                <aside className="lg:max-h-[min(85vh,900px)] lg:overflow-auto">
                    <ShowTalk showId={showId} canAsk={Boolean(access?.questions) && !ownShow} />
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

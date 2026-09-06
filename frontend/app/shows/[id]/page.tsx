"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart, Play } from "lucide-react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import ReviewForm from "@/components/ReviewForm";
import ShowTalk from "@/app/live/[id]/ShowTalk";
import { coverUrl, formatWhen, type MediaItem } from "@/lib/media";
import { isFavorite, toggleFavorite } from "@/lib/library";
import { Button } from "@/components/ui/button";
import MediaRow from "@/components/media/MediaRow";
import TicketPackShop from "@/components/TicketPackShop";

export default function ShowDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [show, setShow] = useState<any>(null);
    const [similar, setSimilar] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [fav, setFav] = useState(false);

    useEffect(() => {
        if (!id) return;
        setFav(isFavorite(String(id), user?.id));
        async function loadShow() {
            try {
                const data = await apiFetch(`/shows/${id}`);
                setShow(data);
            } catch (err: any) {
                setError(err.message || "Nem sikerült betölteni a műsor részleteit.");
            } finally {
                setLoading(false);
            }
        }
        loadShow();
        apiFetch("/shows")
            .then((list) => {
                const rows = Array.isArray(list) ? list : [];
                setSimilar(rows.filter((s: any) => s.id !== id).slice(0, 16));
            })
            .catch(() => setSimilar([]));
    }, [id, user?.id]);

    if (loading) {
        return <p className="px-6 py-20 text-zinc-400">Betöltés...</p>;
    }

    if (error && !show) {
        return <p className="px-6 py-20 text-red-400">{error}</p>;
    }

    if (!show) {
        return <p className="px-6 py-20">A műsor nem található.</p>;
    }

    const ended = Boolean(show.ended) || (!show.live && show.startTime && new Date(show.startTime).getTime() <= Date.now());
    const watchHref = show.live
        ? `/live/${show.id}`
        : ended
          ? `/archive/${show.id}`
          : show.streamUrl || show.streamId
            ? `/live/${show.id}`
            : null;

    return (
        <div className="pb-16">
            <section className="relative min-h-[60dvh] overflow-hidden md:min-h-[70vh]">
                <img src={coverUrl(show)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-black/55 to-black/40" />
                <div className="relative z-10 mx-auto flex min-h-[60dvh] max-w-6xl flex-col justify-end px-4 pb-10 pt-24 md:min-h-[70vh] md:px-10 md:pb-12">
                    {show.live && (
                        <span className="mb-3 w-fit rounded-md bg-red-600 px-2 py-1 text-xs font-bold uppercase">Élő</span>
                    )}
                    {show.videoCategoryLabel && (
                        <span className="mb-3 ml-2 inline-block w-fit rounded-md bg-white/15 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                            {show.videoCategoryLabel}
                        </span>
                    )}
                    <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight md:text-6xl">{show.title}</h1>
                    <p className="mt-3 text-sm uppercase tracking-widest text-accent">
                        {formatWhen(show.startTime)}
                        {show.streamer?.name ? ` · ${show.streamer.name}` : ""}
                    </p>
                    <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                        {watchHref && (
                            <Button asChild size="lg" className="w-full sm:w-auto">
                                <Link href={watchHref}>
                                    <Play className="size-5 fill-current" />
                                    {ended ? "Visszanézés" : "Előnézet / nézés"}
                                </Link>
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="lg"
                            className="w-full sm:w-auto"
                            onClick={() => setFav(toggleFavorite(show, user?.id))}
                        >
                            <Heart className={fav ? "fill-accent text-accent" : ""} />
                            {fav ? "Kedvenc" : "Kedvencekhez"}
                        </Button>
                    </div>
                </div>
            </section>

            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[1.2fr_0.8fr] md:px-10">
                <div>
                    {show.promo?.message && (
                        <p className="mb-6 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-accent">
                            {show.promo.message}
                        </p>
                    )}
                    <p className="max-w-2xl text-zinc-300 leading-relaxed">{show.description}</p>
                    {show.streamer?.id && (
                        <p className="mt-4 text-sm">
                            <Link href={`/streamers/${show.streamer.id}`} className="text-accent hover:underline">
                                {show.streamer.name}
                            </Link>
                        </p>
                    )}
                    <ReviewForm showId={String(id)} />
                    <div className="mt-10">
                        <ShowTalk showId={String(id)} canAsk={Boolean(show.live)} />
                    </div>
                </div>

                <aside className="grid h-fit gap-6">
                    <TicketPackShop compact />
                </aside>
            </div>

            <MediaRow title="Hasonló események" items={similar} />
        </div>
    );
}

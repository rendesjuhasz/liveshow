"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, publicAssetUrl } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import ReportButton from "@/components/ReportButton";

export default function StreamerProfilePage() {
    const params = useParams<{ id: string }>();
    const { user } = useAuth();
    const id =
        typeof params?.id === "string"
            ? params.id
            : Array.isArray(params?.id)
              ? params.id[0]
              : "";
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [followBusy, setFollowBusy] = useState(false);
    const [followError, setFollowError] = useState("");

    useEffect(() => {
        if (!id) return;
        apiFetch(`/streamers/${id}`)
            .then(setData)
            .catch((err: any) => setError(err.message || "A tartalomkészítő nem található."));
    }, [id, user?.id]);

    const toggleFollow = async () => {
        if (!id || !user) return;
        setFollowBusy(true);
        setFollowError("");
        try {
            const res = await apiFetch(`/streamers/${id}/follow`, {
                method: data?.following ? "DELETE" : "POST",
            });
            setData((prev: any) =>
                prev
                    ? {
                          ...prev,
                          following: Boolean(res.following),
                          followerCount: res.followerCount ?? prev.followerCount,
                      }
                    : prev,
            );
        } catch (err: any) {
            setFollowError(err.message || "A követés nem sikerült.");
        } finally {
            setFollowBusy(false);
        }
    };

    if (error) {
        return <p className="p-8 text-red-400">{error}</p>;
    }
    if (!data) {
        return <p className="p-8 text-white">Betöltés...</p>;
    }

    return (
        <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 text-white md:px-10">
            <Link href="/streamers" className="text-sm text-accent hover:underline">
                ← Tartalomkészítők
            </Link>
            <div className="mt-6 mb-4 flex flex-wrap items-center gap-4">
                {data.avatarUrl && (
                    <img
                        src={publicAssetUrl(data.avatarUrl)}
                        alt={String(data.name || "Tartalomkészítő")}
                        className="h-20 w-20 rounded-full object-cover"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="text-3xl font-bold">{data.name}</h1>
                    <p className="text-neutral-400">{data.category}</p>
                    <p className="mt-1 text-sm text-zinc-300">
                        {data.followerCount ?? 0} követő
                    </p>
                </div>
                {user && !data.isOwn ? (
                    <Button
                        type="button"
                        variant={data.following ? "outline" : "gold"}
                        disabled={followBusy}
                        onClick={toggleFollow}
                    >
                        {data.following ? "Követve" : "Követem"}
                    </Button>
                ) : !user ? (
                    <Button asChild variant="gold">
                        <Link href="/login">Követem</Link>
                    </Button>
                ) : null}
            </div>
            {followError && <p className="mb-4 text-sm text-red-400">{followError}</p>}
            {data.bio && <p className="mb-6 text-neutral-300">{data.bio}</p>}
            {user && !data.isOwn && id ? (
                <div className="mb-6">
                    <ReportButton targetType="streamer" targetId={id} label="Tartalomkészítő jelentése" />
                </div>
            ) : null}
            <p className="mb-8 font-semibold text-yellow-400">
                Átlag: {data.average ?? 0} / 5 · {data.count ?? 0} értékelés
            </p>

            <h2 className="mb-3 text-xl font-bold">Műsorok</h2>
            <ul className="mb-10 space-y-2">
                {(data.shows || []).map((s: any) => {
                    const ended = Boolean(s.status === "archived" || s.scheduleStatus === "ended" || s.wentLiveAt);
                    const href = s.live ? `/live/${s.id}` : ended ? `/archive/${s.id}` : `/shows/${s.id}`;
                    return (
                    <li key={s.id}>
                        <Link href={href} className="text-accent hover:underline">
                            {s.title}
                        </Link>
                        {s.live ? (
                            <span className="ml-2 text-sm text-zinc-400">
                                {Number(s.viewerCount || 0).toLocaleString("hu-HU")} néző
                            </span>
                        ) : ended ? (
                            <span className="ml-2 text-sm text-zinc-400">
                                {Number(s.viewCount || 0).toLocaleString("hu-HU")} megtekintés
                            </span>
                        ) : null}
                    </li>
                    );
                })}
                {(!data.shows || data.shows.length === 0) && (
                    <li className="text-neutral-500">Még nincs műsor.</li>
                )}
            </ul>

            <h2 className="mb-3 text-xl font-bold">Értékelések</h2>
            {(data.reviews || []).length === 0 && (
                <p className="text-neutral-500">Még nincs jóváhagyott értékelés.</p>
            )}
            <ul className="space-y-3">
                {(data.reviews || []).map((r: any) => (
                    <li key={r.id} className="rounded-xl bg-neutral-900 p-4">
                        <p className="font-semibold">
                            {r.show?.title} · {r.rating}/5
                        </p>
                        {r.comment && <p className="mt-1 text-neutral-300">{r.comment}</p>}
                        {r.id && (
                            <div className="mt-2">
                                <ReportButton targetType="review" targetId={r.id} />
                            </div>
                        )}
                        <p className="mt-2 text-sm text-neutral-500">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString("hu-HU") : ""}
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

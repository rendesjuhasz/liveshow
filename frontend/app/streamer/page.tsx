"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, publicAssetUrl } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import StreamerShell from "@/components/StreamerShell";
import { formatWatchDuration } from "@/lib/views";

export default function StreamerDashboardPage() {
    const { user, ready } = useAuth();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ready) return;
        if (!user) {
            setLoading(false);
            return;
        }
        apiFetch("/streamers/me")
            .then(setData)
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a dashboardot."))
            .finally(() => setLoading(false));
    }, [ready, user]);

    if (!ready || loading) {
        return <p className="p-8 text-white">Betöltés...</p>;
    }

    if (!user) {
        return (
            <div className="min-h-dvh bg-neutral-950 p-4 text-white sm:p-8">
                <h1 className="text-3xl font-bold mb-4">Tartalomkészítő vezérlőpult</h1>
                <p>A tartalomkészítő felülethez be kell jelentkezned.</p>
                <Link href="/streamer-login" className="text-blue-400 mt-4 inline-block">Tartalomkészítő belépés</Link>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="min-h-dvh bg-neutral-950 p-4 text-white sm:p-8">
                <h1 className="mb-4 text-3xl font-bold">Tartalomkészítő vezérlőpult</h1>
                <p className="text-red-400">{error}</p>
                <Link href="/streamer-login" className="mt-4 inline-block text-blue-400">
                    Tartalomkészítő belépés
                </Link>
            </div>
        );
    }

    if (!data?.streamer) {
        return (
            <div className="min-h-dvh bg-neutral-950 p-4 text-white sm:p-8">
                <h1 className="text-3xl font-bold mb-4">Tartalomkészítő vezérlőpult</h1>
                <p className="mb-4">Ehhez a fiókhoz még nincs tartalomkészítő profil.</p>
                <Link href="/streamer-register" className="text-yellow-400">Tartalomkészítő regisztráció</Link>
            </div>
        );
    }

    if (data.streamer.status === "banned" || data.streamer.status !== "approved" || !data.allowed) {
        return (
            <div className="min-h-dvh max-w-lg bg-neutral-950 p-4 text-white sm:p-8">
                <h1 className="text-3xl font-bold mb-4">Tartalomkészítő vezérlőpult</h1>
                {data.streamer.status === "banned" ? (
                    <p>A tartalomkészítő fiókod tiltva van. A dashboard nem elérhető.</p>
                ) : (
                    <>
                        <p>A fiókod jóváhagyásra vár. A tartalomkészítő felület csak admin jóváhagyás után nyílik meg.</p>
                        <p className="mt-3 text-sm text-zinc-400">
                            Fejlesztésben: jelentkezz be újra a tartalomkészítő fiókkal, vagy az admin gépen
                            {" "}
                            <Link href="/admin/streamers" className="text-yellow-400 underline">
                                /admin/streamers
                            </Link>
                            {" "}
                            oldalon kattints Jóváhagyásra.
                        </p>
                        <Link href="/" className="mt-6 inline-block text-accent underline">
                            Vissza a nézői főoldalra
                        </Link>
                    </>
                )}
            </div>
        );
    }

    return (
        <StreamerShell title="Áttekintés">
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <div className="flex items-center gap-4 mb-8">
                {data.streamer.avatarUrl && (
                    <img
                        src={publicAssetUrl(data.streamer.avatarUrl)}
                        alt=""
                        className="w-16 h-16 rounded-full object-cover"
                    />
                )}
                <div>
                    <p className="text-xl font-semibold">{data.streamer.name}</p>
                </div>
            </div>
            {data.stats?.payoutDue?.label && (
                <p className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                    {data.stats.payoutDue.label}
                </p>
            )}
            <div className="mb-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Követők</p>
                    <p className="text-2xl font-bold">{data.stats?.followerCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Új követők (7 nap)</p>
                    <p className="text-2xl font-bold">{data.stats?.newFollowers7d ?? 0}</p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Műsorok</p>
                    <p className="text-2xl font-bold">{data.stats?.shows ?? 0}</p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Összes megtekintés</p>
                    <p className="text-2xl font-bold">
                        {(data.viewStats?.totalViews ?? data.stats?.totalViews ?? 0).toLocaleString("hu-HU")}
                    </p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Átlagos élő nézőszám</p>
                    <p className="text-2xl font-bold">
                        {(data.viewStats?.averageLiveViewers ?? data.stats?.averageLiveViewers ?? 0).toLocaleString("hu-HU")}
                    </p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Peak nézők</p>
                    <p className="text-2xl font-bold">
                        {(data.viewStats?.peakLiveViewers ?? data.stats?.peakLiveViewers ?? 0).toLocaleString("hu-HU")}
                    </p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Átlagos nézési idő</p>
                    <p className="text-2xl font-bold">
                        {formatWatchDuration(data.viewStats?.averageWatchSeconds ?? data.stats?.averageWatchSeconds)}
                    </p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Nettó bevétel</p>
                    <p className="text-2xl font-bold">{data.stats?.revenue ?? 0} Ft</p>
                </div>
                <div className="rounded-xl bg-neutral-900 p-4 sm:col-span-3">
                    <p className="text-sm text-neutral-400">Elérhető / kifizetve</p>
                    <p className="text-2xl font-bold">
                        {data.stats?.available ?? 0} / {data.stats?.payouts ?? 0} Ft
                    </p>
                </div>
            </div>
            {data.viewStats?.topVideo && (
                <div className="mb-8 rounded-xl bg-neutral-900 p-4">
                    <p className="mb-1 text-sm text-neutral-400">Legnézettebb videó</p>
                    <p className="text-lg font-semibold">{data.viewStats.topVideo.title}</p>
                    <p className="text-sm text-neutral-300">
                        {Number(data.viewStats.topVideo.views || 0).toLocaleString("hu-HU")} megtekintés
                    </p>
                </div>
            )}
            {(data.viewStats?.videos || []).length > 0 && (
                <div className="mb-10 overflow-x-auto rounded-xl bg-neutral-900 p-4">
                    <p className="mb-3 font-semibold">Megtekintések videónként</p>
                    <table className="w-full min-w-[28rem] text-left text-sm">
                        <thead className="text-neutral-400">
                            <tr>
                                <th className="pb-2 font-medium">Videó</th>
                                <th className="pb-2 font-medium">Megtekintés</th>
                                <th className="pb-2 font-medium">Peak</th>
                                <th className="pb-2 font-medium">Átlagos nézés</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.viewStats.videos.map((row: any) => (
                                <tr key={row.showId} className="border-t border-white/10">
                                    <td className="py-2 pr-3">{row.title}</td>
                                    <td className="py-2">{Number(row.views || 0).toLocaleString("hu-HU")}</td>
                                    <td className="py-2">{Number(row.peakViewers || 0).toLocaleString("hu-HU")}</td>
                                    <td className="py-2">{formatWatchDuration(row.avgWatchSeconds)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {(data.viewStats?.streamErrors || []).length > 0 && (
                <div className="mb-10 rounded-xl bg-neutral-900 p-4">
                    <p className="mb-3 font-semibold">Stream indulási hibák</p>
                    <ul className="space-y-2 text-sm">
                        {data.viewStats.streamErrors.map((row: any) => (
                            <li key={row.id} className="border-t border-white/10 pt-2 first:border-0 first:pt-0">
                                <p className="font-medium">{row.showTitle || row.streamId || "Stream"}</p>
                                <p className="text-red-300">{row.message}</p>
                                <p className="text-xs text-neutral-500">
                                    {row.createdAt ? new Date(row.createdAt).toLocaleString("hu-HU") : ""}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {(data.follow?.recentFollowers || []).length > 0 && (
                <div className="mb-8 rounded-xl bg-neutral-900 p-4">
                    <p className="mb-3 font-semibold">Új követők</p>
                    <ul className="space-y-1 text-sm text-neutral-300">
                        {data.follow.recentFollowers.map((row: any) => (
                            <li key={row.id}>
                                {row.name}
                                {row.createdAt
                                    ? ` · ${new Date(row.createdAt).toLocaleString("hu-HU")}`
                                    : ""}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {(data.follow?.shows || []).some((s: any) => s.sent > 0 || s.clicks > 0) && (
                <div className="mb-10 overflow-x-auto rounded-xl bg-neutral-900 p-4">
                    <p className="mb-3 font-semibold">Értesítések eseményenként</p>
                    <table className="w-full min-w-[28rem] text-left text-sm">
                        <thead className="text-neutral-400">
                            <tr>
                                <th className="pb-2 font-medium">Esemény</th>
                                <th className="pb-2 font-medium">Értesítettek</th>
                                <th className="pb-2 font-medium">Kattintások</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.follow.shows.map((row: any) => (
                                <tr key={row.showId} className="border-t border-white/10">
                                    <td className="py-2 pr-3">{row.title}</td>
                                    <td className="py-2 pr-3">{row.sent}</td>
                                    <td className="py-2">{row.clicks}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                    { href: "/streamer/shows", label: "Saját műsorok" },
                    { href: "/streamer/live", label: "Élő adás" },
                    { href: "/streamer/preflight", label: "Ellenőrzés" },
                    { href: "/streamer/moderation", label: "Moderálás" },
                    { href: "/streamer/revenue", label: "Bevételek" },
                    { href: "/streamer/payouts", label: "Kifizetések" },
                    { href: "/streamer/leaderboard", label: "Ranglista" },
                    { href: "/streamer/reviews", label: "Értékelések" },
                ].map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="bg-neutral-900 hover:bg-neutral-800 p-5 rounded-2xl font-semibold"
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </StreamerShell>
    );
}

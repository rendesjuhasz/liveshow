"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, publicAssetUrl } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { streamerCategoryLabel } from "@/lib/streamer-categories";
import { streamerStatusLabel, userAccountStatusLabel } from "@/lib/streamer-status";

export default function AdminStreamerProfilePage() {
    const gate = useAdminGate();
    const params = useParams();
    const id = String(params.id || "");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    function load() {
        apiFetch(`/admin/streamers/${id}`)
            .then(setData)
            .catch((err: any) => setError(err.message || "A tartalomkészítő profil nem tölthető be."));
    }

    useEffect(() => {
        if (gate.ok && id) load();
    }, [gate.ok, id]);

    async function action(path: string) {
        setError("");
        try {
            const next = await apiFetch(`/admin/streamers/${id}/${path}`, { method: "POST" });
            setData(next);
        } catch (err: any) {
            setError(err.message || "A művelet nem sikerült.");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;
    if (!data?.id) return <p className="p-8 text-white">{error || "Betöltés..."}</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Tartalomkészítő profil</h1>
                {error && <p className="text-red-400 mb-4">{error}</p>}
                <div className="bg-gray-800 p-6 rounded-xl mb-6 flex gap-4">
                    {data.avatarUrl && (
                        <img src={publicAssetUrl(data.avatarUrl)} alt="" className="w-20 h-20 rounded-full object-cover" />
                    )}
                    <div>
                        <p className="text-xl font-semibold">{data.name}</p>
                        <p className="text-gray-400">{data.email}</p>
                        <p className="text-sm text-gray-500 mt-1">
                            {streamerCategoryLabel(data.category)} · {streamerStatusLabel(data.status)}
                            {data.userStatus ? ` · fiók: ${userAccountStatusLabel(data.userStatus)}` : ""}
                        </p>
                        {data.bio && <p className="mt-3 text-gray-300">{data.bio}</p>}
                        {data.contactEmail && (
                            <p className="text-sm text-gray-400 mt-2">Kapcsolat: {data.contactEmail}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                    {data.status !== "approved" && (
                        <button type="button" className="bg-green-600 px-4 py-2 rounded" onClick={() => action("approve")}>
                            Jóváhagyás
                        </button>
                    )}
                    {data.status === "pending" && (
                        <button type="button" className="bg-yellow-600 px-4 py-2 rounded" onClick={() => action("reject")}>
                            Elutasítás
                        </button>
                    )}
                    {data.status === "banned" ? (
                        <button type="button" className="bg-blue-600 px-4 py-2 rounded" onClick={() => action("activate")}>
                            Aktiválás
                        </button>
                    ) : (
                        <button type="button" className="bg-red-600 px-4 py-2 rounded" onClick={() => action("ban")}>
                            Tiltás
                        </button>
                    )}
                    {data.user?.id && (
                        <Link href={`/admin/users/${data.user.id}`} className="bg-gray-700 px-4 py-2 rounded">
                            User profil
                        </Link>
                    )}
                </div>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">Műsorok</h2>
                    {data.shows?.length === 0 && <p className="text-gray-400">Nincs műsor.</p>}
                    <ul className="space-y-2 text-sm">
                        {data.shows?.map((show: any) => (
                            <li key={show.id} className="bg-gray-800 p-3 rounded">
                                {show.title}
                                {show.live ? " · élő adás" : " · nincs adásban"} ·{" "}
                                {show.startTime ? new Date(show.startTime).toLocaleString("hu-HU") : "nincs dátum"}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">Jegycsoport bevétel</h2>
                    {data.ticketGroups ? (
                        <>
                            <p className="text-sm text-gray-400 mb-3">
                                Fizetett jegy: {data.ticketGroups.paidTicketsSpent ?? data.ticketGroups.totalTicketsSpent} ·
                                ajándékjegy: {data.ticketGroups.giftTicketsSpent ?? 0} · jóváírás:{" "}
                                {data.ticketGroups.totalCredited} Ft
                            </p>
                            <ul className="space-y-2 text-sm">
                                {(data.ticketGroups.groups || []).map((g: any) => (
                                    <li key={g.key || g.name} className="bg-gray-800 p-3 rounded">
                                        {g.name}: {g.ticketsSpent} db · {g.creditedAmount} Ft
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className="text-gray-400">Nincs jegyköltés.</p>
                    )}
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">Kifizetések</h2>
                    {data.payouts?.length === 0 && <p className="text-gray-400">Nincs kifizetés.</p>}
                    <ul className="space-y-2 text-sm">
                        {data.payouts?.map((p: any) => (
                            <li key={p.id} className="bg-gray-800 p-3 rounded">
                                {p.amount} Ft · {p.status}
                            </li>
                        ))}
                    </ul>
                </section>

                <Link href="/admin/streamers" className="text-blue-400">
                    ← Vissza a tartalomkészítőkhöz
                </Link>
            </div>
        </div>
    );
}

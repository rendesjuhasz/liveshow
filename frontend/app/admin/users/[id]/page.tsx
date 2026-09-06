"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, API_URL } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { streamerStatusLabel, userAccountStatusLabel } from "@/lib/streamer-status";

export default function AdminUserProfilePage() {
    const gate = useAdminGate();
    const params = useParams();
    const id = String(params.id || "");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    function load() {
        apiFetch(`/admin/users/${id}`)
            .then(setData)
            .catch((err: any) => setError(err.message || "A profil nem tölthető be."));
    }

    useEffect(() => {
        if (gate.ok && id) load();
    }, [gate.ok, id]);

    async function setStatus(status: "active" | "banned") {
        setError("");
        try {
            const next = await apiFetch(`/admin/users/${id}/${status === "banned" ? "ban" : "activate"}`, {
                method: "POST",
            });
            setData(next);
        } catch (err: any) {
            setError(err.message || "A státusz módosítása nem sikerült.");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;
    if (!data?.user) return <p className="p-8 text-white">{error || "Betöltés..."}</p>;

    const u = data.user;
    const s = data.streamer;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Felhasználói profil</h1>
                {error && <p className="text-red-400 mb-4">{error}</p>}
                <div className="bg-gray-800 p-6 rounded-xl mb-6">
                    <p className="text-xl font-semibold">{u.email}</p>
                    <p className="text-gray-400 mt-1">
                        {u.role} · {userAccountStatusLabel(u.status)} ·{" "}
                        {new Date(u.createdAt).toLocaleString("hu-HU")}
                    </p>
                    <div className="flex gap-3 mt-4">
                        {u.status === "banned" ? (
                            <button type="button" className="bg-green-600 px-4 py-2 rounded" onClick={() => setStatus("active")}>
                                Aktiválás
                            </button>
                        ) : (
                            <button type="button" className="bg-red-600 px-4 py-2 rounded" onClick={() => setStatus("banned")}>
                                Tiltás
                            </button>
                        )}
                    </div>
                </div>

                {s && (
                    <section className="bg-gray-800 p-6 rounded-xl mb-6">
                        <h2 className="text-xl font-semibold mb-3">Streamer profil</h2>
                        <div className="flex gap-4">
                            {s.avatarUrl && (
                                <img src={`${API_URL}${s.avatarUrl}`} alt="" className="w-16 h-16 rounded-full object-cover" />
                            )}
                            <div>
                                <p className="font-semibold">{s.name}</p>
                                <p className="text-sm text-gray-400">
                                    {streamerStatusLabel(s.status)} · {s.email}
                                </p>
                                {s.bio && <p className="mt-2 text-gray-300">{s.bio}</p>}
                                <Link href={`/admin/streamers/${s.id}`} className="text-blue-400 text-sm mt-2 inline-block">
                                    Streamer adatlap
                                </Link>
                            </div>
                        </div>
                    </section>
                )}

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">Jegyek</h2>
                    {data.tickets?.length === 0 && <p className="text-gray-400">Nincs jegy.</p>}
                    <ul className="space-y-2 text-sm">
                        {data.tickets?.map((t: any) => (
                            <li key={t.id} className="bg-gray-800 p-3 rounded">
                                {t.show?.title} · {t.category?.name || "jegy"} · {t.status} · {t.price} Ft
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">Kérdések</h2>
                    {data.questions?.length === 0 && <p className="text-gray-400">Nincs kérdés.</p>}
                    <ul className="space-y-2 text-sm">
                        {data.questions?.map((q: any) => (
                            <li key={q.id} className="bg-gray-800 p-3 rounded">
                                <span className="uppercase text-xs text-yellow-400">{q.status}</span> · {q.text}
                            </li>
                        ))}
                    </ul>
                </section>

                <Link href="/admin/users" className="text-blue-400">
                    ← Vissza a felhasználókhoz
                </Link>
            </div>
        </div>
    );
}

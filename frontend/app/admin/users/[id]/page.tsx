"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, publicAssetUrl } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { streamerStatusLabel, userAccountStatusLabel } from "@/lib/streamer-status";
import { useT } from "@/lib/i18n/I18nProvider";

export default function AdminUserProfilePage() {
    const { formatDateTime } = useT();
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
                    <p className="text-xl font-semibold">{u.username ? `@${u.username}` : u.email}</p>
                    {u.username ? <p className="text-sm text-gray-400">{u.email}</p> : null}
                    <p className="text-gray-400 mt-1">
                        {u.role} · {userAccountStatusLabel(u.status)} · {u.provider || "local"} ·{" "}
                        {formatDateTime(u.createdAt)}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                        Utolsó belépés:{" "}
                        {u.lastLoginAt
                            ? `${formatDateTime(u.lastLoginAt)} (${u.lastLoginProvider || u.provider || "local"})`
                            : "még nincs"}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        Kapcsolt: Google {u.googleLinked ? "igen" : "nem"} · Microsoft{" "}
                        {u.microsoftLinked ? "igen" : "nem"} · Apple {u.appleLinked ? "igen" : "nem"}
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
                        <h2 className="text-xl font-semibold mb-3">Tartalomkészítő profil</h2>
                        <div className="flex gap-4">
                            {s.avatarUrl && (
                                <img src={publicAssetUrl(s.avatarUrl)} alt="" className="w-16 h-16 rounded-full object-cover" />
                            )}
                            <div>
                                <p className="font-semibold">{s.name}</p>
                                <p className="text-sm text-gray-400">
                                    {streamerStatusLabel(s.status)} · {s.email}
                                </p>
                                {s.bio && <p className="mt-2 text-gray-300">{s.bio}</p>}
                                <Link href={`/admin/streamers/${s.id}`} className="text-blue-400 text-sm mt-2 inline-block">
                                    Tartalomkészítő adatlap
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
                                {t.show?.title} · {t.status} · {t.price} Ft
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

                {Array.isArray(data.authEvents) && data.authEvents.length > 0 && (
                    <section className="mb-6">
                        <h2 className="text-xl font-semibold mb-3">Belépési napló</h2>
                        <ul className="space-y-2 text-sm">
                            {data.authEvents.map((e: any) => (
                                <li key={e.id} className="bg-gray-800 p-3 rounded">
                                    {e.action} · {e.provider} · {formatDateTime(e.createdAt)}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <Link href="/admin/users" className="text-blue-400">
                    ← Vissza a felhasználókhoz
                </Link>
            </div>
        </div>
    );
}

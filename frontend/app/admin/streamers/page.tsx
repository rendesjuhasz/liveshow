"use client";

import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { streamerCategoryLabel } from "@/lib/streamer-categories";
import { streamerStatusLabel } from "@/lib/streamer-status";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">{title}</h1>
                {children}
                <a href="/admin" className="block mt-8 text-blue-400">← Vissza az adminhoz</a>
            </div>
        </div>
    );
}

export default function AdminStreamersPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [bio, setBio] = useState("");
    const [error, setError] = useState("");

    function load() {
        setError("");
        apiFetch("/admin/streamers")
            .then((d) => {
                const list = Array.isArray(d) ? d : [];
                list.sort((a, b) => {
                    const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
                    return rank(a.status) - rank(b.status);
                });
                setRows(list);
            })
            .catch((err: any) => setError(err.message || "A streamerek nem tölthetők be."));
    }

    useEffect(() => {
        if (gate.ok) load();
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <Shell title="Streamerek">
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <p className="text-sm text-gray-400 mb-4">
                Az új streamer-regisztrációk pending státusszal itt jelennek meg, felül a várakozók.
            </p>
            <form
                className="bg-gray-800 p-4 rounded-xl mb-6 grid gap-2"
                onSubmit={async (e) => {
                    e.preventDefault();
                    await apiFetch("/admin/streamers", {
                        method: "POST",
                        body: JSON.stringify({ name, email, bio }),
                    });
                    setName("");
                    setEmail("");
                    setBio("");
                    load();
                }}
            >
                <input className="p-2 text-black rounded" placeholder="Név" value={name} onChange={(e) => setName(e.target.value)} required />
                <input className="p-2 text-black rounded" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="p-2 text-black rounded" placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
                <button className="bg-blue-600 p-2 rounded font-semibold">Streamer hozzáadása</button>
            </form>
            {rows.length === 0 && !error && (
                <p className="text-gray-400 mb-4">Még nincs streamer a rendszerben.</p>
            )}
            <ul className="space-y-3">
                {rows.map((s) => (
                    <li key={s.id} className="bg-gray-800 p-4 rounded-xl flex justify-between">
                        <div className="flex gap-3">
                            {s.avatarUrl && (
                                <img
                                    src={`${API_URL}${s.avatarUrl}`}
                                    alt=""
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                            )}
                            <div>
                                <p className="font-bold">{s.name}</p>
                                <p className="text-sm text-gray-400">{s.email}</p>
                                <p className="text-sm text-gray-500">
                                    {streamerCategoryLabel(s.category)}
                                    {s.contactEmail ? ` · ${s.contactEmail}` : ""}
                                </p>
                                <p
                                    className={
                                        s.status === "approved"
                                            ? "text-sm text-green-400"
                                            : s.status === "banned"
                                              ? "text-sm text-red-400"
                                              : "text-sm text-yellow-400"
                                    }
                                >
                                    {streamerStatusLabel(s.status)}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <a href={`/admin/streamers/${s.id}`} className="text-blue-400">
                                profil
                            </a>
                            {s.status !== "approved" && (
                                <button
                                    className="text-green-400"
                                    onClick={async () => {
                                        await apiFetch(`/admin/streamers/${s.id}/approve`, { method: "POST" });
                                        load();
                                    }}
                                >
                                    jóváhagyás
                                </button>
                            )}
                            {(s.status === "pending" || s.status === "approved") && (
                                <button
                                    className="text-orange-400"
                                    onClick={async () => {
                                        await apiFetch(`/admin/streamers/${s.id}/reject`, { method: "POST" });
                                        load();
                                    }}
                                >
                                    elutasítás
                                </button>
                            )}
                            {s.status === "banned" ? (
                                <button
                                    className="text-green-200"
                                    onClick={async () => {
                                        await apiFetch(`/admin/streamers/${s.id}/activate`, { method: "POST" });
                                        load();
                                    }}
                                >
                                    aktiválás
                                </button>
                            ) : (
                                <button
                                    className="text-yellow-400"
                                    onClick={async () => {
                                        await apiFetch(`/admin/streamers/${s.id}/ban`, { method: "POST" });
                                        load();
                                    }}
                                >
                                    tiltás
                                </button>
                            )}
                            <button
                                className="text-red-400"
                                onClick={async () => {
                                    await apiFetch(`/admin/streamers/${s.id}`, { method: "DELETE" });
                                    load();
                                }}
                            >
                                törlés
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </Shell>
    );
}

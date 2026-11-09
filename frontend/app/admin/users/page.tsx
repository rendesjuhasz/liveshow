"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { streamerStatusLabel, userAccountStatusLabel } from "@/lib/streamer-status";
import { useT } from "@/lib/i18n/I18nProvider";

export default function AdminUsersPage() {
    const { formatDateTime } = useT();
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [q, setQ] = useState("");
    const [error, setError] = useState("");

    function load() {
        apiFetch("/admin/users")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a felhasználókat."));
    }

    useEffect(() => {
        if (gate.ok) load();
    }, [gate.ok]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter(
            (u) =>
                String(u.email || "").toLowerCase().includes(s) ||
                String(u.role || "").toLowerCase().includes(s) ||
                String(u.streamer?.name || "").toLowerCase().includes(s),
        );
    }, [rows, q]);

    async function setStatus(id: string, status: "active" | "banned") {
        setError("");
        try {
            await apiFetch(`/admin/users/${id}/${status === "banned" ? "ban" : "activate"}`, {
                method: "POST",
            });
            load();
        } catch (err: any) {
            setError(err.message || "A státusz módosítása nem sikerült.");
        }
    }

    async function approveStreamer(streamerId: string) {
        setError("");
        try {
            await apiFetch(`/admin/streamers/${streamerId}/approve`, { method: "POST" });
            load();
        } catch (err: any) {
            setError(err.message || "A tartalomkészítő jóváhagyása nem sikerült.");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Felhasználók</h1>
                <p className="text-gray-400 mb-6">Összes fiók, tiltás, aktiválás, profilok.</p>
                {error && <p className="text-red-400 mb-4">{error}</p>}
                <input
                    className="p-3 rounded text-black w-full max-w-md mb-6"
                    placeholder="Keresés email / szerepkör / tartalomkészítő név"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <ul className="space-y-3">
                    {filtered.map((u) => (
                        <li key={u.id} className="bg-gray-800 p-4 rounded-xl flex flex-wrap justify-between gap-3">
                            <div>
                                <p className="font-semibold">
                                    {u.username ? `@${u.username}` : u.email}
                                </p>
                                <p className="text-sm text-gray-400">
                                    {u.email} · {u.role} · {userAccountStatusLabel(u.status)} · {u.provider || "local"}
                                    {u.lastLoginAt
                                        ? ` · utolsó belépés: ${formatDateTime(u.lastLoginAt)}`
                                        : ""}
                                    {u.streamer
                                        ? ` · tartalomkészítő: ${u.streamer.name} (${streamerStatusLabel(u.streamer.status)})`
                                        : ""}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 items-center">
                                <Link href={`/admin/users/${u.id}`} className="text-blue-400">
                                    profil
                                </Link>
                                {u.streamer?.status === "pending" && (
                                    <button
                                        type="button"
                                        className="text-green-400"
                                        onClick={() => approveStreamer(u.streamer.id)}
                                    >
                                        tartalomkészítő jóváhagyása
                                    </button>
                                )}
                                {u.status === "banned" ? (
                                    <button type="button" className="text-green-400" onClick={() => setStatus(u.id, "active")}>
                                        aktiválás
                                    </button>
                                ) : (
                                    <button type="button" className="text-red-400" onClick={() => setStatus(u.id, "banned")}>
                                        tiltás
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
                {filtered.length === 0 && <p className="text-gray-400">Nincs találat.</p>}
                <a href="/admin" className="block mt-8 text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

export default function AdminCampaignsPage() {
    const gate = useAdminGate();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [shows, setShows] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [form, setForm] = useState({
        name: "",
        type: "first_users",
        showId: "",
        categoryKey: "nezo",
        maxClaims: 10,
        status: "active",
    });

    async function load() {
        const [list, showList] = await Promise.all([
            apiFetch("/admin/campaigns"),
            apiFetch("/admin/shows"),
        ]);
        setCampaigns(Array.isArray(list) ? list : []);
        setShows(Array.isArray(showList) ? showList : []);
    }

    useEffect(() => {
        if (gate.ok) load().catch((err) => setError(err.message || "Betöltés sikertelen."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Ajándékjegy-kampányok</h1>
                <p className="text-gray-400 mb-6">
                    Első X felhasználó vagy első X vásárló ingyenjegye. Az egyszeri kiosztás a{" "}
                    <a className="text-blue-400 underline" href="/admin/tickets">
                        Jegyek
                    </a>{" "}
                    oldalon marad.
                </p>

                {error && <p className="text-red-400 mb-4">{error}</p>}
                {message && <p className="text-green-400 mb-4">{message}</p>}

                <form
                    className="bg-gray-800 p-4 rounded-xl mb-8 grid gap-3 md:grid-cols-2"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        setMessage("");
                        try {
                            await apiFetch("/admin/campaigns", {
                                method: "POST",
                                body: JSON.stringify({
                                    ...form,
                                    maxClaims: Number(form.maxClaims),
                                }),
                            });
                            setForm((prev) => ({ ...prev, name: "" }));
                            setMessage("Kampány létrehozva.");
                            await load();
                        } catch (err: any) {
                            setError(err.message || "A kampány mentése sikertelen.");
                        }
                    }}
                >
                    <input
                        className="p-2 text-black rounded"
                        placeholder="Kampány neve"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                    />
                    <select
                        className="p-2 text-black rounded"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                        <option value="first_users">Első X felhasználó (regisztrációkor)</option>
                        <option value="first_buyers">Első X vásárló (jegyvásárláskor)</option>
                    </select>
                    <select
                        className="p-2 text-black rounded"
                        value={form.showId}
                        onChange={(e) => setForm({ ...form, showId: e.target.value })}
                        required
                    >
                        <option value="">Műsor</option>
                        {shows.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.title}
                            </option>
                        ))}
                    </select>
                    <select
                        className="p-2 text-black rounded"
                        value={form.categoryKey}
                        onChange={(e) => setForm({ ...form, categoryKey: e.target.value })}
                    >
                        <option value="nezo">Néző jegy</option>
                        <option value="interaktiv">Interaktív jegy</option>
                        <option value="vip">VIP jegy</option>
                    </select>
                    <label className="text-sm text-gray-300">
                        Ingyenjegyek száma (X)
                        <input
                            className="mt-1 p-2 text-black rounded w-full"
                            type="number"
                            min={1}
                            value={form.maxClaims}
                            onChange={(e) => setForm({ ...form, maxClaims: Number(e.target.value) })}
                            required
                        />
                    </label>
                    <select
                        className="p-2 text-black rounded self-end"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                        <option value="draft">Piszkozat</option>
                        <option value="active">Aktív</option>
                        <option value="paused">Szünetel</option>
                        <option value="ended">Lezárva</option>
                    </select>
                    <button className="md:col-span-2 bg-yellow-500 text-black font-bold py-2 rounded">
                        Kampány mentése
                    </button>
                </form>

                <ul className="space-y-3">
                    {campaigns.map((c) => (
                        <li key={c.id} className="bg-gray-800 p-4 rounded-xl">
                            <div className="flex flex-wrap justify-between gap-2">
                                <div>
                                    <p className="font-semibold">{c.name}</p>
                                    <p className="text-sm text-gray-300">
                                        {c.typeLabel} · {c.showTitle} · {c.categoryKey} · {c.claimCount}/
                                        {c.maxClaims} kiosztva · {c.statusLabel}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {c.status !== "active" && (
                                        <button
                                            className="bg-green-600 px-3 py-1 rounded text-sm"
                                            onClick={async () => {
                                                await apiFetch(`/admin/campaigns/${c.id}`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({ status: "active" }),
                                                });
                                                load();
                                            }}
                                        >
                                            Aktiválás
                                        </button>
                                    )}
                                    {c.status === "active" && (
                                        <button
                                            className="bg-gray-600 px-3 py-1 rounded text-sm"
                                            onClick={async () => {
                                                await apiFetch(`/admin/campaigns/${c.id}`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({ status: "paused" }),
                                                });
                                                load();
                                            }}
                                        >
                                            Szüneteltetés
                                        </button>
                                    )}
                                    <button
                                        className="bg-blue-600 px-3 py-1 rounded text-sm"
                                        onClick={async () => {
                                            const detail = await apiFetch(`/admin/campaigns/${c.id}`);
                                            setSelected(detail);
                                        }}
                                    >
                                        Kiosztások
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                    {campaigns.length === 0 && (
                        <li className="text-gray-400">Még nincs kampány.</li>
                    )}
                </ul>

                {selected && (
                    <div className="mt-8 bg-gray-800 p-4 rounded-xl">
                        <h2 className="text-xl font-semibold mb-3">{selected.name} — kiosztások</h2>
                        <ul className="space-y-2 text-sm">
                            {(selected.claims || []).map((g: any) => (
                                <li key={g.id}>
                                    {g.userEmail} · {g.source} ·{" "}
                                    {g.createdAt
                                        ? new Date(g.createdAt).toLocaleString("hu-HU")
                                        : ""}
                                </li>
                            ))}
                            {(!selected.claims || selected.claims.length === 0) && (
                                <li className="text-gray-400">Még nincs kiosztás.</li>
                            )}
                        </ul>
                    </div>
                )}

                <a href="/admin" className="block mt-8 text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

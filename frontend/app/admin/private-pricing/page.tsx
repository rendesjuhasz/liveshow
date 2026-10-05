"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

export default function AdminPrivatePricingPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    function load() {
        apiFetch("/admin/private-price-bands").then((d) => setRows(Array.isArray(d) ? d : []));
    }

    useEffect(() => {
        if (gate.ok) load();
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-xl">
                <a href="/admin" className="text-sm text-yellow-300 underline">
                    ← Vissza az adminhoz
                </a>
                <h1 className="mt-4 mb-2 text-3xl font-bold">Privát stream ársávok</h1>
                <p className="mb-6 text-gray-400">
                    A tartalomkészítő értékelése (1–5 csillag) alapján csak ebben a sávban adhat ajánlatot.
                    Az új ajánlatokra azonnal érvényes.
                </p>
                <form
                    className="grid gap-4 rounded-xl bg-gray-800 p-6"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        setMessage("");
                        try {
                            const next = await apiFetch("/admin/private-price-bands", {
                                method: "PUT",
                                body: JSON.stringify({
                                    items: rows.map((r) => ({
                                        stars: Number(r.stars),
                                        minPrice: Number(r.minPrice),
                                        maxPrice: Number(r.maxPrice),
                                    })),
                                }),
                            });
                            setRows(Array.isArray(next) ? next : rows);
                            setMessage("Az ársávok mentve.");
                        } catch (err: any) {
                            setError(err.message || "Mentés sikertelen.");
                        }
                    }}
                >
                    {rows.map((row, idx) => (
                        <div key={row.stars} className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr]">
                            <p className="self-end font-semibold">{row.stars} csillag</p>
                            <label className="grid gap-1 text-sm">
                                Minimum Ft
                                <input
                                    className="rounded p-3 text-black"
                                    type="number"
                                    min={0}
                                    value={row.minPrice}
                                    onChange={(e) => {
                                        const next = [...rows];
                                        next[idx] = { ...row, minPrice: e.target.value };
                                        setRows(next);
                                    }}
                                />
                            </label>
                            <label className="grid gap-1 text-sm">
                                Maximum Ft
                                <input
                                    className="rounded p-3 text-black"
                                    type="number"
                                    min={0}
                                    value={row.maxPrice}
                                    onChange={(e) => {
                                        const next = [...rows];
                                        next[idx] = { ...row, maxPrice: e.target.value };
                                        setRows(next);
                                    }}
                                />
                            </label>
                        </div>
                    ))}
                    {error && <p className="text-red-400">{error}</p>}
                    {message && <p className="text-green-400">{message}</p>}
                    <button type="submit" className="rounded-xl bg-yellow-500 p-3 font-bold text-black">
                        Mentés
                    </button>
                </form>
            </div>
        </div>
    );
}

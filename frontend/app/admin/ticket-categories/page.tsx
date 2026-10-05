"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

export default function AdminTicketCategoriesPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    function load() {
        apiFetch("/ticket-packs")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "Nem tölthető be."));
    }

    useEffect(() => {
        if (gate.ok) load();
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="mx-auto max-w-xl">
                <a href="/admin" className="text-sm text-yellow-300 underline">
                    ← Vissza az adminhoz
                </a>
                <h1 className="mt-4 mb-2 text-3xl font-bold">Jegycsomagok</h1>
                <p className="mb-6 text-gray-400">
                    Ezek a nézői jegycsomagok (Alap, Ezüst, Arany, Gyémánt). Kérdéshez és értékeléshez
                    kellenek. Az élő és az archív nézés ingyenes. A Ft/jegy a csomagár és a jegyszám
                    alapján számolódik. A privát stream árát a Privát stream ársávok menü állítja.
                </p>
                <form
                    className="grid gap-4 rounded-xl bg-gray-800 p-6"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        setMessage("");
                        try {
                            const next = await apiFetch("/admin/ticket-packs", {
                                method: "PUT",
                                body: JSON.stringify({
                                    items: rows.map((r) => ({
                                        key: r.key,
                                        name: r.name,
                                        ticketCount: Number(r.ticketCount),
                                        price: Number(r.price),
                                    })),
                                }),
                            });
                            setRows(Array.isArray(next) ? next : rows);
                            setMessage("A jegycsomagok mentve. Az új vásárlásokra azonnal érvényes.");
                        } catch (err: any) {
                            setError(err.message || "Mentés sikertelen.");
                        }
                    }}
                >
                    {rows.map((row, idx) => {
                        const count = Number(row.ticketCount) || 1;
                        const price = Number(row.price) || 0;
                        const unit = Math.round(price / count);
                        return (
                            <div key={row.key} className="grid gap-2 rounded-xl border border-white/10 p-3">
                                <p className="font-semibold">{row.name}</p>
                                <label className="grid gap-1 text-sm">
                                    Jegyszám a csomagban
                                    <input
                                        className="rounded p-3 text-black"
                                        type="number"
                                        min={1}
                                        value={row.ticketCount}
                                        onChange={(e) => {
                                            const next = [...rows];
                                            next[idx] = { ...row, ticketCount: e.target.value };
                                            setRows(next);
                                        }}
                                    />
                                </label>
                                <label className="grid gap-1 text-sm">
                                    Csomagár (Ft)
                                    <input
                                        className="rounded p-3 text-black"
                                        type="number"
                                        min={0}
                                        value={row.price}
                                        onChange={(e) => {
                                            const next = [...rows];
                                            next[idx] = { ...row, price: e.target.value };
                                            setRows(next);
                                        }}
                                    />
                                </label>
                                <p className="text-xs text-gray-400">{unit} Ft/jegy a tartalomkészítő jóváírásnál</p>
                            </div>
                        );
                    })}
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

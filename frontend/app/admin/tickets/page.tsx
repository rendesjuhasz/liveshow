"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { ticketStatusLabelHu } from "@/lib/ticket-status";

export default function AdminTicketsPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [shows, setShows] = useState<any[]>([]);
    const [email, setEmail] = useState("");
    const [showId, setShowId] = useState("");
    const [categoryKey, setCategoryKey] = useState("nezo");

    function load() {
        apiFetch("/admin/tickets").then((d) => setRows(Array.isArray(d) ? d : []));
        apiFetch("/admin/shows").then((d) => setShows(Array.isArray(d) ? d : []));
    }

    useEffect(() => {
        if (gate.ok) load();
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Jegyek</h1>
                <p className="text-gray-400 mb-6">
                    Egyszeri ajándékjegy e-mail alapján. Kampányokhoz:{" "}
                    <a className="text-blue-400 underline" href="/admin/campaigns">
                        Ajándék kampányok
                    </a>
                    .
                </p>
                <form
                    className="bg-gray-800 p-4 rounded-xl mb-6 flex flex-wrap gap-2"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        await apiFetch("/admin/tickets/gift", {
                            method: "POST",
                            body: JSON.stringify({ email, showId, categoryKey }),
                        });
                        setEmail("");
                        load();
                    }}
                >
                    <input className="p-2 text-black rounded" placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <select className="p-2 text-black rounded" value={showId} onChange={(e) => setShowId(e.target.value)} required>
                        <option value="">Műsor</option>
                        {shows.map((s) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>
                    <select className="p-2 text-black rounded" value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
                        <option value="nezo">Néző jegy</option>
                        <option value="interaktiv">Interaktív jegy</option>
                        <option value="vip">VIP jegy</option>
                    </select>
                    <button className="bg-yellow-500 text-black font-bold px-4 rounded">Ajándékjegy</button>
                </form>
                <ul className="space-y-2">
                    {rows.map((t) => (
                        <li key={t.id} className="bg-gray-800 p-3 rounded-lg text-sm">
                            {t.user?.email} · {t.show?.title} · {t.categoryName || t.categoryKey || "jegy"} · {t.statusLabel || ticketStatusLabelHu(t.status)} · {t.price} Ft
                        </li>
                    ))}
                </ul>
                <a href="/admin" className="block mt-8 text-blue-400">← Vissza az adminhoz</a>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { ticketStatusLabelHu, isTicketActiveStatus } from "@/lib/ticket-status";

export default function AdminTicketsPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [email, setEmail] = useState("");
    const [ticketCount, setTicketCount] = useState("1");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    function load() {
        apiFetch("/admin/tickets").then((d) => setRows(Array.isArray(d) ? d : []));
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
                    Ajándék kérdésjegy a néző egyenlegére (TicketPack). Kampányokhoz:{" "}
                    <a className="text-blue-400 underline" href="/admin/campaigns">
                        Ajándék kampányok
                    </a>
                    .
                </p>
                <form
                    className="bg-gray-800 p-4 rounded-xl mb-6 flex flex-wrap gap-2"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        setMessage("");
                        try {
                            const data = await apiFetch("/admin/tickets/gift", {
                                method: "POST",
                                body: JSON.stringify({
                                    email,
                                    ticketCount: Number(ticketCount) || 1,
                                }),
                            });
                            setEmail("");
                            setTicketCount("1");
                            setMessage(data?.message || "Kérdésjegy jóváírva.");
                            load();
                        } catch (err: any) {
                            setError(err.message || "A kiosztás sikertelen.");
                        }
                    }}
                >
                    <input
                        className="p-2 text-black rounded"
                        placeholder="User email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        className="w-24 p-2 text-black rounded"
                        type="number"
                        min={1}
                        max={10000}
                        value={ticketCount}
                        onChange={(e) => setTicketCount(e.target.value)}
                        aria-label="Kérdésjegyek száma"
                    />
                    <button className="bg-yellow-500 text-black font-bold px-4 rounded">Ajándék kérdésjegy</button>
                </form>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                {message && <p className="mb-4 text-sm text-emerald-400">{message}</p>}
                <ul className="space-y-2">
                    {rows.map((t) => (
                        <li key={t.id} className="bg-gray-800 p-3 rounded-lg text-sm">
                            {t.user?.email} · {t.show?.title} · {t.statusLabel || ticketStatusLabelHu(t.status)} · {t.price} Ft
                            {isTicketActiveStatus(t.status) && (
                                <button
                                    type="button"
                                    className="ml-3 text-accent underline"
                                    onClick={async () => {
                                        await apiFetch(`/admin/tickets/${t.id}/resend`, { method: "POST" });
                                        load();
                                    }}
                                >
                                    Újraküldés
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
                <a href="/admin" className="block mt-8 text-blue-400">← Vissza az adminhoz</a>
            </div>
        </div>
    );
}

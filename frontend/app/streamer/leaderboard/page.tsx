"use client";

import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerLeaderboardPage() {
    const gate = useStreamerGate();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/leaderboard")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "A ranglista nem tölthető be."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Ranglista">
            <p className="text-neutral-400 mb-6">
                A sorrend a felhasznált jegyek bruttó értékén alapul. A számokat a streamer nem szerkesztheti.
            </p>
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <ol className="space-y-2">
                {rows.map((row) => (
                    <li key={row.id} className="bg-neutral-900 p-4 rounded-xl flex items-center gap-4">
                        <span className="text-yellow-400 font-black w-8">{row.rank}.</span>
                        {row.avatarUrl ? (
                            <img src={`${API_URL}${row.avatarUrl}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : null}
                        <div className="flex-1">
                            <p className="font-semibold">{row.name}</p>
                            <p className="text-sm text-neutral-400">
                                {row.tickets} jegy · bruttó {row.gross} Ft · nettó {row.net} Ft
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
            {rows.length === 0 && <p className="text-neutral-400">Még nincs ranglista-adat.</p>}
        </StreamerShell>
    );
}

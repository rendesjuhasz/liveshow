"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerReviewsPage() {
    const gate = useStreamerGate();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/reviews")
            .then(setData)
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni az értékeléseket."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Értékelések">
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <p className="text-neutral-400 mb-6">
                Nyilvános átlag: {data?.average ?? 0} / 5 · {data?.count ?? 0} jóváhagyott értékelés
            </p>
            {data?.reviews?.length === 0 && <p className="text-neutral-400">Még nincs értékelés a műsoraidra.</p>}
            <ul className="space-y-3">
                {data?.reviews?.map((r: any) => (
                    <li key={r.id} className="bg-neutral-900 p-4 rounded-xl">
                        <p className="font-semibold">{r.show?.title} · {r.rating}/5</p>
                        {r.status && r.status !== "approved" && (
                            <p className="text-sm text-yellow-400 mt-1">
                                {r.status === "pending"
                                    ? "Moderálásra vár — a nézők még nem látják"
                                    : "Elutasítva — a nézők nem látják"}
                            </p>
                        )}
                        {r.comment && <p className="text-neutral-300 mt-1">{r.comment}</p>}
                        <p className="text-sm text-neutral-500 mt-2">
                            {new Date(r.createdAt).toLocaleString("hu-HU")}
                        </p>
                    </li>
                ))}
            </ul>
        </StreamerShell>
    );
}

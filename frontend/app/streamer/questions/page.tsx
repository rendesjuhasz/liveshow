"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import StreamerCurrentQuestion from "@/components/StreamerCurrentQuestion";
import { useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerQuestionsPage() {
    const gate = useStreamerGate();
    const [shows, setShows] = useState<any[]>([]);
    const [showId, setShowId] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/shows")
            .then((d) => {
                const rows = Array.isArray(d) ? d : [];
                setShows(rows);
                const live = rows.find((s: any) => s.live);
                if (live?.id) setShowId(live.id);
                else if (rows[0]?.id) setShowId(rows[0].id);
            })
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a műsorokat."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) {
        return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;
    }

    return (
        <StreamerShell title="Aktuális kérdés">
            {error && <p className="mb-4 text-red-400">{error}</p>}
            {showId ? (
                <StreamerCurrentQuestion shows={shows} showId={showId} onShowIdChange={setShowId} />
            ) : (
                <p className="text-neutral-400">Először hozz létre egy műsort.</p>
            )}
        </StreamerShell>
    );
}

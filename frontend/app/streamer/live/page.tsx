"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import StreamerCurrentQuestion from "@/components/StreamerCurrentQuestion";
import { useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerLivePage() {
    const gate = useStreamerGate();
    const [shows, setShows] = useState<any[]>([]);
    const [showId, setShowId] = useState("");
    const [streamId, setStreamId] = useState("");
    const [rtpPort, setRtpPort] = useState("5004");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/shows")
            .then((d) => {
                const rows = Array.isArray(d) ? d : [];
                setShows(rows);
                const pref =
                    new URLSearchParams(window.location.search).get("show") || rows[0]?.id || "";
                setShowId(pref);
                const found = rows.find((s: any) => s.id === pref) || rows[0];
                if (found?.streamId) setStreamId(found.streamId);
            })
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a műsorokat."));
    }, [gate.ok]);

    useEffect(() => {
        const found = shows.find((s) => s.id === showId);
        if (found?.streamId) setStreamId(found.streamId);
    }, [showId, shows]);

    const selected = shows.find((s) => s.id === showId);
    const isLive = Boolean(selected?.live);

    async function setLive(live: boolean) {
        if (!showId || busy) return;
        setError("");
        setMessage("");
        setBusy(true);
        try {
            const data = await apiFetch(`/streamer/shows/${showId}/live`, {
                method: "POST",
                body: JSON.stringify({
                    live,
                    streamId,
                    rtpPort: Number(rtpPort),
                }),
            });
            const nextLive = data?.show?.live === true;
            if (data?.show?.id) {
                setShows((prev) =>
                    prev.map((s) =>
                        s.id === data.show.id ? { ...s, ...data.show, live: nextLive } : s,
                    ),
                );
            }
            setMessage(
                live
                    ? "Az élő adás elindult."
                    : data?.ingest?.archive?.pending
                      ? "Az adás leállt. Ha volt felvétel, az archívum a háttérben készül."
                      : data?.ingest?.archive?.exists
                        ? "Az adás leállt, a felvétel bekerült a visszanézésbe."
                        : data?.ingest?.archive?.error
                          ? `Az adás leállt, de az archívum nem készült el: ${data.ingest.archive.error}`
                          : "Az élő adás leállt.",
            );
            if (data?.ingest?.warning) {
                setMessage(`${live ? "Élőre kapcsolva." : "Az adás leállt."} ${data.ingest.warning}`);
            }
            const rows = await apiFetch("/streamer/shows");
            setShows(Array.isArray(rows) ? rows : []);
        } catch (err: any) {
            setError(err.message || "Nem sikerült frissíteni az élő állapotot.");
        } finally {
            setBusy(false);
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Élő adás kezelése">
            {shows.length === 0 ? (
                <p className="text-neutral-400">Először hozz létre egy műsort.</p>
            ) : (
                <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
                    <div className="grid gap-4 rounded-2xl bg-neutral-900 p-6">
                        <p
                            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                                isLive
                                    ? "bg-red-600/20 text-red-300"
                                    : "bg-neutral-800 text-neutral-300"
                            }`}
                        >
                            {isLive
                                ? "Most élőben megy. A leállítás után a műsor nem marad élő, még ha a katalógusban Aktív is."
                                : "Nincs élő adás. Az admin „Aktív” státusz csak annyit jelent, hogy a műsor jóvá van hagyva, nem azt, hogy most megy."}
                        </p>
                        <label className="grid gap-1">
                            Műsor
                            <select
                                className="rounded p-3 text-black"
                                value={showId}
                                onChange={(e) => setShowId(e.target.value)}
                                disabled={busy}
                            >
                                {shows.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.title}
                                        {s.live ? " (élő)" : " (nincs adásban)"}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="grid gap-1">
                            Stream ID
                            <input
                                className="rounded p-3 text-black"
                                value={streamId}
                                onChange={(e) => setStreamId(e.target.value)}
                                disabled={busy}
                            />
                        </label>
                        <label className="grid gap-1">
                            RTP port
                            <input
                                className="rounded p-3 text-black"
                                type="number"
                                value={rtpPort}
                                onChange={(e) => setRtpPort(e.target.value)}
                                disabled={busy}
                            />
                        </label>
                        {error && <p className="text-red-400">{error}</p>}
                        {message && <p className="text-green-400">{message}</p>}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setLive(true)}
                                disabled={busy || isLive}
                                className="rounded-xl bg-green-600 px-4 py-3 font-bold disabled:opacity-50"
                            >
                                {busy && !isLive ? "Indítás..." : "Élő indítása"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setLive(false)}
                                disabled={busy}
                                className="rounded-xl bg-neutral-700 px-4 py-3 font-bold disabled:opacity-50"
                            >
                                {busy && isLive ? "Leállítás..." : "Adás leállítása"}
                            </button>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-neutral-900 p-6">
                        <h2 className="mb-4 font-semibold">Aktuális kérdés</h2>
                        {showId ? (
                            <StreamerCurrentQuestion shows={shows} showId={showId} />
                        ) : (
                            <p className="text-neutral-400">Válassz műsort.</p>
                        )}
                    </div>
                </div>
            )}
        </StreamerShell>
    );
}

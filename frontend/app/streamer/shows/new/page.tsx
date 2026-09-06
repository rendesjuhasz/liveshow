"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import VideoCategorySelect from "@/components/VideoCategorySelect";

export default function StreamerNewShowPage() {
    const gate = useStreamerGate();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startTime, setStartTime] = useState("");
    const [streamId, setStreamId] = useState("");
    const [videoCategory, setVideoCategory] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            await apiFetch("/streamer/shows", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    description,
                    startTime: startTime ? new Date(startTime).toISOString() : "",
                    streamId,
                    videoCategory,
                }),
            });
            router.push("/streamer/shows");
        } catch (err: any) {
            setError(err.message || "Nem sikerült létrehozni a műsort.");
        } finally {
            setBusy(false);
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Új műsor létrehozása">
            <form onSubmit={submit} className="max-w-xl grid gap-4 bg-neutral-900 p-6 rounded-2xl">
                <p className="text-sm text-neutral-400">
                    A műsor a létrehozás után megjelenik a nézői oldalon a Hamarosan
                    eseményeknél. Ehhez jövőbeli kezdési időpont kell.
                </p>
                <label className="grid gap-1">
                    Cím
                    <input
                        className="p-3 rounded text-black"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </label>
                <label className="grid gap-1">
                    Kategória
                    <VideoCategorySelect value={videoCategory} onChange={setVideoCategory} />
                </label>
                <label className="grid gap-1">
                    Leírás
                    <textarea
                        className="p-3 rounded text-black min-h-24"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </label>
                <label className="grid gap-1">
                    Kezdés
                    <input
                        className="p-3 rounded text-black"
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                    />
                </label>
                <label className="grid gap-1">
                    Stream ID (opcionális)
                    <input
                        className="p-3 rounded text-black"
                        value={streamId}
                        onChange={(e) => setStreamId(e.target.value)}
                        placeholder="üresen automatikus"
                    />
                </label>
                {error && <p className="text-red-400">{error}</p>}
                <button
                    disabled={busy}
                    className="bg-yellow-500 text-black font-bold p-3 rounded-xl disabled:opacity-50"
                >
                {busy ? "Mentés..." : "Műsor közzététele"}
                </button>
            </form>
        </StreamerShell>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { showStatusLabel } from "@/lib/show-status";
import VideoCategorySelect from "@/components/VideoCategorySelect";

export default function StreamerShowEditPage() {
    const gate = useStreamerGate();
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState("draft");
    const [videoCategory, setVideoCategory] = useState("");
    const [startTime, setStartTime] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!gate.ok || !id) return;
        apiFetch(`/streamer/shows/${id}`)
            .then((show) => {
                setTitle(show?.title || "");
                setDescription(show?.description || "");
                setStatus(show?.status || "draft");
                setVideoCategory(show?.videoCategory || "");
                if (show?.startTime) {
                    const d = new Date(show.startTime);
                    if (!Number.isNaN(d.getTime())) {
                        const pad = (n: number) => String(n).padStart(2, "0");
                        setStartTime(
                            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                        );
                    }
                }
            })
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni."));
    }, [gate.ok, id]);

    async function save() {
        await apiFetch(`/streamer/shows/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
                title,
                description,
                videoCategory,
                startTime: startTime ? new Date(startTime).toISOString() : "",
            }),
        });
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title={`Műsor: ${title}`}>
            <p className="text-neutral-400 mb-4">Státusz: {showStatusLabel(status)}</p>
            <p className="text-sm text-neutral-500 mb-4 max-w-xl">
                Ha a státusz Aktív és a kezdés a jövőben van, a műsor a nézői Főoldalon a
                Hamarosan eseményeknél látszik.
            </p>
            <form
                className="max-w-xl grid gap-3 bg-neutral-900 p-6 rounded-2xl"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setError("");
                    setBusy(true);
                    try {
                        await save();
                        router.push("/streamer/shows");
                    } catch (err: any) {
                        setError(err.message || "Nem sikerült menteni.");
                    } finally {
                        setBusy(false);
                    }
                }}
            >
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
                    Kategória
                    <VideoCategorySelect value={videoCategory} onChange={setVideoCategory} />
                </label>
                {error && <p className="text-red-400">{error}</p>}
                <button
                    disabled={busy}
                    className="bg-yellow-500 text-black font-bold p-3 rounded-xl disabled:opacity-50"
                >
                    Mentés
                </button>
                {(status === "draft" || status === "pending") && (
                    <button
                        type="button"
                        disabled={busy}
                        className="bg-blue-600 font-bold p-3 rounded-xl disabled:opacity-50"
                        onClick={async () => {
                            setError("");
                            setBusy(true);
                            try {
                                await save();
                                await apiFetch(`/streamer/shows/${id}/submit`, { method: "POST" });
                                router.push("/streamer/shows");
                            } catch (err: any) {
                                setError(err.message || "A közzététel nem sikerült.");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Közzététel a nézői oldalon
                    </button>
                )}
            </form>
        </StreamerShell>
    );
}

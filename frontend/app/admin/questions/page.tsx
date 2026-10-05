"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useModeratorGate } from "@/lib/useModeratorGate";

export default function AdminQuestionsPage() {
    const gate = useModeratorGate();
    const [shows, setShows] = useState<any[]>([]);
    const [showId, setShowId] = useState("");
    const [queue, setQueue] = useState<any>(null);
    const [audit, setAudit] = useState<any[]>([]);
    const [banned, setBanned] = useState<any[]>([]);
    const [word, setWord] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const [tab, setTab] = useState<"queue" | "audit" | "banned">("queue");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/shows")
            .then((d) => {
                const rows = Array.isArray(d) ? d : [];
                setShows(rows);
                if (!showId && rows[0]?.id) setShowId(rows[0].id);
            })
            .catch(() => undefined);
        apiFetch("/questions/banned-words")
            .then((d) => setBanned(Array.isArray(d) ? d : []))
            .catch(() => undefined);
    }, [gate.ok]);

    async function loadQueue(id = showId) {
        if (!id) return;
        const data = await apiFetch(`/questions/moderation?showId=${encodeURIComponent(id)}`);
        setQueue(data);
        const log = await apiFetch(`/questions/audit?showId=${encodeURIComponent(id)}`);
        setAudit(Array.isArray(log) ? log : []);
    }

    useEffect(() => {
        if (!gate.ok || !showId) return;
        loadQueue(showId).catch((err: any) => setError(err.message || "Betöltési hiba."));
        const t = setInterval(() => loadQueue(showId).catch(() => undefined), 12_000);
        return () => clearInterval(t);
    }, [gate.ok, showId]);

    async function review(id: string, status: "rejected") {
        setError("");
        try {
            await apiFetch(`/questions/${id}/review`, {
                method: "PATCH",
                body: JSON.stringify({ status, note }),
            });
            setNote("");
            await loadQueue();
        } catch (err: any) {
            setError(err.message || "A státusz frissítése nem sikerült.");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs moderátori jogosultság.</p>;

    const pending = (queue?.questions || []).filter((q: any) => q.status === "pending");
    const others = (queue?.questions || []).filter((q: any) => q.status !== "pending");

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Kérdésmoderálás</h1>
                <p className="text-gray-400 mb-6">
                    A rangsort a rendszer számolja. Moderátor csak tiltott tartalmat utasíthat el.
                    A teljesítést a tartalomkészítő gombja végzi. Kérdezők: {queue?.askerCount ?? 0} /{" "}
                    {queue?.maxAskers ?? 10}
                </p>
                {error && <p className="text-red-400 mb-4">{error}</p>}

                <label className="grid gap-1 max-w-md mb-6">
                    Műsor
                    <select
                        className="p-3 rounded text-black"
                        value={showId}
                        onChange={(e) => setShowId(e.target.value)}
                    >
                        {shows.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.title}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="flex gap-2 mb-6">
                    {(
                        [
                            ["queue", "Sor"],
                            ["audit", "Audit napló"],
                            ["banned", "Tiltott szavak"],
                        ] as const
                    ).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setTab(id)}
                            className={`px-3 py-2 rounded-lg text-sm ${
                                tab === id ? "bg-blue-600" : "bg-gray-800"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === "queue" && (
                    <div className="grid gap-6">
                        <label className="grid gap-1 max-w-md">
                            Elutasítás indoka (opcionális)
                            <input
                                className="p-2 rounded text-black"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </label>
                        <section>
                            <h2 className="text-xl font-semibold mb-3">Függőben</h2>
                            {pending.length === 0 && (
                                <p className="text-gray-400">Nincs pending kérdés.</p>
                            )}
                            <ul className="space-y-3">
                                {pending.map((q: any) => (
                                    <li key={q.id} className="bg-gray-800 p-4 rounded-xl">
                                        <p>{q.text}</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            {q.user?.email} · {new Date(q.createdAt).toLocaleString("hu-HU")}
                                        </p>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                type="button"
                                                className="bg-red-600 px-3 py-1 rounded"
                                                onClick={() => review(q.id, "rejected")}
                                            >
                                                Elutasítás
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                        <section>
                            <h2 className="text-xl font-semibold mb-3">Többi kérdés</h2>
                            <ul className="space-y-2 text-sm">
                                {others.map((q: any) => (
                                    <li key={q.id} className="bg-gray-800/70 p-3 rounded">
                                        <span className="uppercase text-xs text-yellow-400">{q.status}</span>
                                        {" · "}
                                        {q.text}
                                        {q.filterReason ? ` (${q.filterReason})` : ""}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                )}

                {tab === "audit" && (
                    <ul className="space-y-2 text-sm">
                        {audit.length === 0 && <li className="text-gray-400">Nincs naplóbejegyzés.</li>}
                        {audit.map((a: any) => (
                            <li key={a.id} className="bg-gray-800 p-3 rounded">
                                <p>
                                    {a.action} · {a.fromStatus || "—"} → {a.toStatus}
                                    {a.note ? ` · ${a.note}` : ""}
                                </p>
                                <p className="text-gray-400">
                                    {a.actor?.email || "rendszer"} · {a.question?.text} ·{" "}
                                    {new Date(a.createdAt).toLocaleString("hu-HU")}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}

                {tab === "banned" && (
                    <div>
                        <form
                            className="flex gap-2 mb-4"
                            onSubmit={async (e) => {
                                e.preventDefault();
                                await apiFetch("/questions/banned-words", {
                                    method: "POST",
                                    body: JSON.stringify({ word }),
                                });
                                setWord("");
                                setBanned(await apiFetch("/questions/banned-words"));
                            }}
                        >
                            <input
                                className="p-2 rounded text-black"
                                value={word}
                                onChange={(e) => setWord(e.target.value)}
                                placeholder="Tiltott szó"
                                required
                            />
                            <button className="bg-blue-600 px-4 rounded">Hozzáadás</button>
                        </form>
                        <ul className="space-y-2">
                            {banned.map((w: any) => (
                                <li key={w.id} className="flex justify-between bg-gray-800 p-3 rounded">
                                    <span>{w.word}</span>
                                    <button
                                        type="button"
                                        className="text-red-400"
                                        onClick={async () => {
                                            await apiFetch(`/questions/banned-words/${w.id}`, {
                                                method: "DELETE",
                                            });
                                            setBanned(await apiFetch("/questions/banned-words"));
                                        }}
                                    >
                                        törlés
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <a href="/admin" className="block mt-8 text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

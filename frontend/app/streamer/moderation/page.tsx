"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";

const REASON_LABEL: Record<string, string> = {
    spam: "Spam",
    harassment: "Zaklatás",
    illegal: "Jogellenes",
    off_platform: "Külső kapcsolat",
    other: "Egyéb",
};

export default function StreamerModerationPage() {
    const gate = useStreamerGate();
    const [shows, setShows] = useState<any[]>([]);
    const [showId, setShowId] = useState("");
    const [tab, setTab] = useState<"questions" | "chat" | "reports">("questions");
    const [queue, setQueue] = useState<any>(null);
    const [chat, setChat] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [note, setNote] = useState("");
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

    async function load() {
        if (!showId) return;
        const [q, c, r] = await Promise.all([
            apiFetch(`/streamer/questions/queue?showId=${encodeURIComponent(showId)}`),
            apiFetch(`/streamer/chat?showId=${encodeURIComponent(showId)}`).catch(() => []),
            apiFetch("/streamer/reports?status=open").catch(() => []),
        ]);
        setQueue(q);
        setChat(Array.isArray(c) ? c : []);
        setReports(Array.isArray(r) ? r : []);
    }

    useEffect(() => {
        if (!gate.ok || !showId) return;
        load().catch((err: any) => setError(err.message || "Betöltési hiba."));
        const t = setInterval(() => load().catch(() => undefined), 12_000);
        return () => clearInterval(t);
    }, [gate.ok, showId]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) {
        return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;
    }

    const pending = (queue?.questions || []).filter((q: any) => q.status === "pending");

    return (
        <StreamerShell title="Moderálás">
            {error && <p className="mb-4 text-red-400">{error}</p>}
            <p className="mb-4 max-w-2xl text-sm text-neutral-400">
                Saját műsoraid kérdései, chatje és a róluk szóló jelentések. Platformszintű értékeléseket
                a moderátorok bírálják el.
            </p>
            <label className="mb-6 grid max-w-md gap-1">
                Műsor
                <select
                    className="rounded p-3 text-black"
                    value={showId}
                    onChange={(e) => setShowId(e.target.value)}
                >
                    {shows.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.title}
                            {s.live ? " · élő" : ""}
                        </option>
                    ))}
                </select>
            </label>
            <div className="mb-6 flex flex-wrap gap-2">
                {(
                    [
                        ["questions", "Kérdések"],
                        ["chat", "Chat"],
                        ["reports", `Jelentések (${reports.length})`],
                    ] as const
                ).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`rounded-lg px-3 py-2 text-sm ${
                            tab === id ? "bg-primary text-[#0b1220] font-semibold" : "bg-card"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === "questions" && (
                <div>
                    <label className="mb-4 grid max-w-md gap-1 text-sm">
                        Elutasítás indoka (opcionális)
                        <input
                            className="rounded p-2 text-black"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </label>
                    {pending.length === 0 && <p className="text-neutral-400">Nincs függőben lévő kérdés.</p>}
                    <ul className="space-y-3">
                        {pending.map((q: any) => (
                            <li key={q.id} className="rounded-xl bg-neutral-900 p-4">
                                <p>{q.text}</p>
                                <p className="mt-1 text-sm text-neutral-500">{q.user?.email}</p>
                                <button
                                    type="button"
                                    className="mt-3 rounded bg-red-700 px-3 py-1"
                                    onClick={async () => {
                                        setError("");
                                        try {
                                            await apiFetch(`/streamer/questions/${q.id}/review`, {
                                                method: "PATCH",
                                                body: JSON.stringify({ status: "rejected", note }),
                                            });
                                            setNote("");
                                            await load();
                                        } catch (err: any) {
                                            setError(err.message || "Elutasítás sikertelen.");
                                        }
                                    }}
                                >
                                    Elutasítás
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {tab === "chat" && (
                <ul className="space-y-2">
                    {chat.length === 0 && <li className="text-neutral-400">Nincs chatüzenet.</li>}
                    {chat.map((c: any) => (
                        <li key={c.id} className="rounded-xl bg-neutral-900 p-3 text-sm">
                            <span className="text-xs uppercase text-yellow-400">{c.status}</span>
                            {" · "}
                            {c.author}: {c.text}
                            {c.status === "approved" && (
                                <button
                                    type="button"
                                    className="ml-3 text-red-400"
                                    onClick={async () => {
                                        await apiFetch(`/streamer/chat/${c.id}`, { method: "PATCH" });
                                        await load();
                                    }}
                                >
                                    Eltávolítás
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {tab === "reports" && (
                <ul className="space-y-3">
                    {reports.length === 0 && <li className="text-neutral-400">Nincs nyitott jelentés.</li>}
                    {reports.map((r: any) => (
                        <li key={r.id} className="rounded-xl bg-neutral-900 p-4">
                            <p className="font-semibold">
                                {r.targetType} · {REASON_LABEL[r.reason] || r.reason}
                            </p>
                            {r.details && <p className="mt-1 text-neutral-300">{r.details}</p>}
                            <p className="mt-1 text-xs text-neutral-500">{r.reporterEmail}</p>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    className="rounded bg-neutral-700 px-3 py-1 text-sm"
                                    onClick={async () => {
                                        await apiFetch(`/streamer/reports/${r.id}`, {
                                            method: "PATCH",
                                            body: JSON.stringify({ status: "dismissed" }),
                                        });
                                        await load();
                                    }}
                                >
                                    Elutasítás
                                </button>
                                <button
                                    type="button"
                                    className="rounded bg-emerald-700 px-3 py-1 text-sm"
                                    onClick={async () => {
                                        await apiFetch(`/streamer/reports/${r.id}`, {
                                            method: "PATCH",
                                            body: JSON.stringify({ status: "actioned" }),
                                        });
                                        await load();
                                    }}
                                >
                                    Intézkedve
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </StreamerShell>
    );
}

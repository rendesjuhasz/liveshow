"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useModeratorGate } from "@/lib/useModeratorGate";

const REASON_LABEL: Record<string, string> = {
    spam: "Spam",
    harassment: "Zaklatás",
    illegal: "Jogellenes",
    off_platform: "Külső kapcsolat",
    other: "Egyéb",
};

export default function AdminReportsPage() {
    const gate = useModeratorGate();
    const [rows, setRows] = useState<any[]>([]);
    const [filter, setFilter] = useState<"open" | "all">("open");
    const [error, setError] = useState("");
    const [note, setNote] = useState("");

    async function load(status = filter) {
        const data = await apiFetch(`/reports?status=${status === "all" ? "all" : "open"}`);
        setRows(Array.isArray(data) ? data : []);
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err: any) => setError(err.message || "Nem sikerült betölteni a jelentéseket."));
    }, [gate.ok, filter]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs moderátori jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-2 text-3xl font-bold">Jelentések</h1>
                <p className="mb-6 text-gray-400">
                    Nézői jelentések kérdésre, értékelésre, tartalomkészítőre, műsorra és chatre.
                </p>
                {error && <p className="mb-4 text-red-400">{error}</p>}
                <div className="mb-4 flex gap-2">
                    <button
                        type="button"
                        className={`rounded-lg px-3 py-2 text-sm ${filter === "open" ? "bg-blue-600" : "bg-gray-800"}`}
                        onClick={() => setFilter("open")}
                    >
                        Nyitott
                    </button>
                    <button
                        type="button"
                        className={`rounded-lg px-3 py-2 text-sm ${filter === "all" ? "bg-blue-600" : "bg-gray-800"}`}
                        onClick={() => setFilter("all")}
                    >
                        Összes
                    </button>
                </div>
                <label className="mb-4 grid max-w-md gap-1 text-sm">
                    Jegyzet (opcionális)
                    <input
                        className="rounded p-2 text-black"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </label>
                {rows.length === 0 && <p className="text-gray-400">Nincs ilyen jelentés.</p>}
                <ul className="space-y-3">
                    {rows.map((r) => (
                        <li key={r.id} className="rounded-xl bg-gray-800 p-4">
                            <p className="font-semibold">
                                {r.targetType} · {REASON_LABEL[r.reason] || r.reason} · {r.status}
                            </p>
                            <p className="text-sm text-gray-400">
                                {r.reporterEmail} · {r.targetId}
                            </p>
                            {r.details && <p className="mt-2">{r.details}</p>}
                            {r.status === "open" && (
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        className="rounded bg-gray-600 px-3 py-1"
                                        onClick={async () => {
                                            await apiFetch(`/reports/${r.id}`, {
                                                method: "PATCH",
                                                body: JSON.stringify({ status: "dismissed", note }),
                                            });
                                            setNote("");
                                            await load();
                                        }}
                                    >
                                        Elutasítás
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded bg-green-700 px-3 py-1"
                                        onClick={async () => {
                                            await apiFetch(`/reports/${r.id}`, {
                                                method: "PATCH",
                                                body: JSON.stringify({ status: "actioned", note }),
                                            });
                                            setNote("");
                                            await load();
                                        }}
                                    >
                                        Intézkedve
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
                <a href="/admin" className="mt-8 block text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

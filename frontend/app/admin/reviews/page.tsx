"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useModeratorGate } from "@/lib/useModeratorGate";
import { useT } from "@/lib/i18n/I18nProvider";

const LABELS: Record<string, string> = {
    pending: "Függőben",
    approved: "Jóváhagyva",
    rejected: "Elutasítva",
};

export default function AdminReviewsPage() {
    const { formatDateTime } = useT();
    const gate = useModeratorGate();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<"pending" | "all">("pending");

    async function load() {
        const data = await apiFetch("/reviews/moderation");
        setRows(Array.isArray(data) ? data : []);
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err: any) => setError(err.message || "Nem sikerült betölteni az értékeléseket."));
    }, [gate.ok]);

    async function setStatus(id: string, status: "approved" | "rejected" | "pending") {
        setError("");
        try {
            await apiFetch(`/reviews/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            await load();
        } catch (err: any) {
            setError(err.message || "A státusz frissítése nem sikerült.");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs moderátori jogosultság.</p>;

    const visible = filter === "pending" ? rows.filter((r) => r.status === "pending") : rows;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Értékelések moderálása</h1>
                <p className="text-gray-400 mb-6">
                    Új értékelések pending státuszban várnak. Csak a jóváhagyottak jelennek meg a
                    tartalomkészítő profilon és a műsoroldalon.
                </p>
                {error && <p className="text-red-400 mb-4">{error}</p>}

                <div className="flex gap-2 mb-6">
                    <button
                        type="button"
                        className={`px-3 py-2 rounded-lg text-sm ${filter === "pending" ? "bg-blue-600" : "bg-gray-800"}`}
                        onClick={() => setFilter("pending")}
                    >
                        Függőben ({rows.filter((r) => r.status === "pending").length})
                    </button>
                    <button
                        type="button"
                        className={`px-3 py-2 rounded-lg text-sm ${filter === "all" ? "bg-blue-600" : "bg-gray-800"}`}
                        onClick={() => setFilter("all")}
                    >
                        Összes ({rows.length})
                    </button>
                </div>

                {visible.length === 0 && (
                    <p className="text-gray-400">Nincs ilyen értékelés.</p>
                )}
                <ul className="space-y-3">
                    {visible.map((r) => (
                        <li key={r.id} className="bg-gray-800 p-4 rounded-xl">
                            <p className="font-semibold">
                                {r.showTitle} · {r.rating}/5 · {LABELS[r.status] || r.status}
                            </p>
                            <p className="text-sm text-gray-400">{r.userEmail}</p>
                            {r.comment && <p className="mt-2 text-gray-200">{r.comment}</p>}
                            <p className="text-xs text-gray-500 mt-2">
                                {r.createdAt ? formatDateTime(r.createdAt) : ""}
                            </p>
                            <div className="flex gap-2 mt-3">
                                {r.status !== "approved" && (
                                    <button
                                        type="button"
                                        className="bg-green-600 px-3 py-1 rounded"
                                        onClick={() => setStatus(r.id, "approved")}
                                    >
                                        Jóváhagyás
                                    </button>
                                )}
                                {r.status !== "rejected" && (
                                    <button
                                        type="button"
                                        className="bg-red-600 px-3 py-1 rounded"
                                        onClick={() => setStatus(r.id, "rejected")}
                                    >
                                        Elutasítás
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

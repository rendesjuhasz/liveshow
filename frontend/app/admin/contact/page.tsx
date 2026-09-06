"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

export default function AdminContactPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/admin/contact")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err) => setError(err.message || "Betöltés sikertelen."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Kapcsolat üzenetek</h1>
                {error && <p className="text-red-400 mb-4">{error}</p>}
                <ul className="space-y-3">
                    {rows.map((row) => (
                        <li key={row.id} className="bg-gray-800 p-4 rounded-xl">
                            <p className="font-semibold">
                                {row.name} · {row.email}
                            </p>
                            <p className="text-sm text-gray-400 mb-2">
                                {row.createdAt
                                    ? new Date(row.createdAt).toLocaleString("hu-HU")
                                    : ""}
                            </p>
                            <p className="whitespace-pre-wrap text-gray-200">{row.message}</p>
                        </li>
                    ))}
                    {rows.length === 0 && !error && (
                        <li className="text-gray-400">Még nincs üzenet.</li>
                    )}
                </ul>
                <a href="/admin" className="block mt-8 text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

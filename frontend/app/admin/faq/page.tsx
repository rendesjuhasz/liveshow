"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

const CATEGORIES = ["Jegyvásárlás", "Közvetítések", "Fiókom", "Fizetés", "Archívum"];

type FaqRow = {
    id: string;
    category: string;
    question: string;
    answer: string;
    order: number;
    isPublished: boolean;
};

const emptyForm = {
    category: "Jegyvásárlás",
    question: "",
    answer: "",
    order: 0,
    isPublished: true,
};

export default function AdminFaqPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<FaqRow[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function load() {
        const data = await apiFetch("/admin/faq");
        setRows(Array.isArray(data) ? data : []);
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err) => setError(err.message || "Betöltés sikertelen."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setMessage("");
        try {
            if (editingId) {
                await apiFetch(`/admin/faq/${editingId}`, {
                    method: "PATCH",
                    body: JSON.stringify(form),
                });
                setMessage("Kérdés frissítve.");
            } else {
                await apiFetch("/admin/faq", {
                    method: "POST",
                    body: JSON.stringify(form),
                });
                setMessage("Kérdés létrehozva.");
            }
            setForm(emptyForm);
            setEditingId(null);
            await load();
        } catch (err: any) {
            setError(err.message || "Mentés sikertelen.");
        }
    }

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">FAQ kezelése</h1>
                {error && <p className="text-red-400 mb-4">{error}</p>}
                {message && <p className="text-green-400 mb-4">{message}</p>}

                <form onSubmit={save} className="bg-gray-800 p-4 rounded-xl mb-8 grid gap-3">
                    <select
                        className="p-2 text-black rounded"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                    <input
                        className="p-2 text-black rounded"
                        placeholder="Kérdés"
                        value={form.question}
                        onChange={(e) => setForm({ ...form, question: e.target.value })}
                        required
                    />
                    <textarea
                        className="p-2 text-black rounded min-h-28"
                        placeholder="Válasz"
                        value={form.answer}
                        onChange={(e) => setForm({ ...form, answer: e.target.value })}
                        required
                    />
                    <label className="text-sm flex items-center gap-2">
                        Sorrend
                        <input
                            className="p-2 text-black rounded w-24"
                            type="number"
                            min={0}
                            value={form.order}
                            onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                        />
                    </label>
                    <label className="text-sm flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.isPublished}
                            onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                        />
                        Publikálva
                    </label>
                    <div className="flex gap-2">
                        <button className="bg-yellow-500 text-black font-bold px-4 py-2 rounded">
                            {editingId ? "Módosítás mentése" : "Kérdés létrehozása"}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                className="px-4 py-2 rounded border border-gray-500"
                                onClick={() => {
                                    setEditingId(null);
                                    setForm(emptyForm);
                                }}
                            >
                                Mégse
                            </button>
                        )}
                    </div>
                </form>

                <ul className="space-y-3">
                    {rows.map((row) => (
                        <li key={row.id} className="bg-gray-800 p-4 rounded-xl">
                            <p className="text-sm text-yellow-400">{row.category} · sorrend {row.order}</p>
                            <p className="font-semibold">{row.question}</p>
                            <p className="text-gray-300 whitespace-pre-wrap mt-1">{row.answer}</p>
                            <p className="text-xs text-gray-500 mt-2">
                                {row.isPublished ? "Publikálva" : "Rejtett"}
                            </p>
                            <div className="flex gap-3 mt-3 text-sm">
                                <button
                                    className="text-blue-400"
                                    onClick={() => {
                                        setEditingId(row.id);
                                        setForm({
                                            category: row.category,
                                            question: row.question,
                                            answer: row.answer,
                                            order: row.order,
                                            isPublished: row.isPublished,
                                        });
                                    }}
                                >
                                    Szerkesztés
                                </button>
                                <button
                                    className="text-red-400"
                                    onClick={async () => {
                                        if (!confirm("Törlöd ezt a kérdést?")) return;
                                        await apiFetch(`/admin/faq/${row.id}`, { method: "DELETE" });
                                        load();
                                    }}
                                >
                                    Törlés
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                <a href="/admin" className="block mt-8 text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

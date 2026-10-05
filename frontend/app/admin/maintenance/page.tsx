"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

type Catalog = {
    services: { id: string; label: string }[];
    kinds: { id: string; label: string }[];
};

type EventRow = {
    id: string;
    name: string;
    description: string;
    kind: string;
    status: string;
    services: string[];
    startsAt: string;
    endsAt: string;
    createdByName?: string | null;
    logs?: { id: string; action: string; actorName?: string; description?: string; createdAt: string }[];
};

const emptyForm = {
    name: "",
    description: "",
    kind: "partial",
    startsAt: "",
    endsAt: "",
    services: [] as string[],
};

function toLocalInput(value?: string) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string) {
    if (!local) return "";
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function AdminMaintenancePage() {
    const gate = useAdminGate();
    const [catalog, setCatalog] = useState<Catalog>({ services: [], kinds: [] });
    const [rows, setRows] = useState<EventRow[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selected, setSelected] = useState<EventRow | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function load() {
        const [cat, list] = await Promise.all([
            apiFetch("/admin/maintenance/catalog"),
            apiFetch("/admin/maintenance"),
        ]);
        setCatalog(cat);
        setRows(Array.isArray(list) ? list : []);
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err) => setError(err.message || "Betöltés sikertelen."));
    }, [gate.ok]);

    const active = useMemo(() => rows.filter((r) => r.status === "active" || r.status === "scheduled"), [rows]);
    const past = useMemo(() => rows.filter((r) => r.status === "completed" || r.status === "cancelled"), [rows]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    function toggleService(id: string) {
        setForm((prev) => ({
            ...prev,
            services: prev.services.includes(id) ? prev.services.filter((s) => s !== id) : [...prev.services, id],
        }));
    }

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setMessage("");
        const payload = {
            ...form,
            startsAt: toIso(form.startsAt),
            endsAt: toIso(form.endsAt),
        };
        try {
            if (editingId) {
                await apiFetch(`/admin/maintenance/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
                setMessage("Karbantartás frissítve.");
            } else {
                await apiFetch("/admin/maintenance", { method: "POST", body: JSON.stringify(payload) });
                setMessage("Karbantartás mentve.");
            }
            setForm(emptyForm);
            setEditingId(null);
            await load();
        } catch (err: any) {
            setError(err.message || "Mentés sikertelen.");
        }
    }

    function startNow() {
        const start = new Date();
        const end = new Date(Date.now() + 60 * 60_000);
        setForm((prev) => ({
            ...prev,
            kind: prev.kind === "info" ? "emergency" : prev.kind,
            startsAt: toLocalInput(start.toISOString()),
            endsAt: toLocalInput(end.toISOString()),
        }));
    }

    function edit(row: EventRow) {
        setEditingId(row.id);
        setForm({
            name: row.name,
            description: row.description,
            kind: row.kind,
            startsAt: toLocalInput(row.startsAt),
            endsAt: toLocalInput(row.endsAt),
            services: row.services || [],
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function closeEvent(id: string) {
        setError("");
        try {
            await apiFetch(`/admin/maintenance/${id}/close`, { method: "POST", body: JSON.stringify({}) });
            setMessage("Karbantartás befejezve.");
            await load();
        } catch (err: any) {
            setError(err.message || "Lezárás sikertelen.");
        }
    }

    async function openLogs(id: string) {
        try {
            const row = await apiFetch(`/admin/maintenance/${id}`);
            setSelected(row);
        } catch (err: any) {
            setError(err.message || "Napló betöltése sikertelen.");
        }
    }

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-2 text-3xl font-bold">Karbantartás</h1>
                <p className="mb-6 text-gray-400">
                    Ütemezett vagy azonnali karbantartás. A rendszer bannerrel jelez, a kiválasztott
                    szolgáltatásokat automatikusan letiltja, majd a végén visszaáll.
                </p>
                {error && <p className="mb-4 text-red-400">{error}</p>}
                {message && <p className="mb-4 text-emerald-400">{message}</p>}

                <div className="mb-4 flex flex-wrap gap-2">
                    <button type="button" onClick={startNow} className="rounded-lg bg-red-700 px-3 py-2 text-sm">
                        Azonnali karbantartás (kezdés most, 1 óra)
                    </button>
                </div>

                <form onSubmit={save} className="mb-10 space-y-4 rounded-xl bg-gray-800 p-4">
                    <h2 className="text-xl font-semibold">{editingId ? "Aktív / ütemezett szerkesztése" : "Új karbantartás"}</h2>
                    <input
                        className="w-full rounded bg-gray-900 p-2"
                        placeholder="Név"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <textarea
                        className="w-full rounded bg-gray-900 p-2"
                        placeholder="Leírás"
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                    <div className="grid gap-3 md:grid-cols-3">
                        <label className="text-sm text-gray-300">
                            Típus
                            <select
                                className="mt-1 w-full rounded bg-gray-900 p-2 text-white"
                                value={form.kind}
                                onChange={(e) => setForm({ ...form, kind: e.target.value })}
                            >
                                {catalog.kinds.map((k) => (
                                    <option key={k.id} value={k.id}>
                                        {k.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm text-gray-300">
                            Kezdés
                            <input
                                type="datetime-local"
                                className="mt-1 w-full rounded bg-gray-900 p-2 text-white"
                                value={form.startsAt}
                                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                            />
                        </label>
                        <label className="text-sm text-gray-300">
                            Befejezés
                            <input
                                type="datetime-local"
                                className="mt-1 w-full rounded bg-gray-900 p-2 text-white"
                                value={form.endsAt}
                                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                            />
                        </label>
                    </div>
                    <fieldset>
                        <legend className="mb-2 text-sm text-gray-300">Érintett szolgáltatások</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {catalog.services.map((s) => (
                                <label key={s.id} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={form.services.includes(s.id)}
                                        onChange={() => toggleService(s.id)}
                                    />
                                    {s.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="flex gap-2">
                        <button type="submit" className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black">
                            {editingId ? "Mentés" : "Létrehozás"}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                className="rounded-lg bg-gray-700 px-4 py-2"
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

                <h2 className="mb-3 text-xl font-semibold">Aktív és ütemezett</h2>
                <div className="mb-10 space-y-3">
                    {active.length === 0 && <p className="text-gray-400">Nincs aktív vagy ütemezett esemény.</p>}
                    {active.map((row) => (
                        <div key={row.id} className="rounded-xl bg-gray-800 p-4">
                            <p className="font-semibold">
                                {row.name} · {row.status} · {row.kind}
                            </p>
                            <p className="text-sm text-gray-400">
                                {new Date(row.startsAt).toLocaleString("hu-HU")} – {new Date(row.endsAt).toLocaleString("hu-HU")}
                            </p>
                            <p className="text-sm text-gray-400">{(row.services || []).join(", ") || "nincs korlátozás"}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" className="rounded bg-white/10 px-3 py-1 text-sm" onClick={() => edit(row)}>
                                    Szerkesztés
                                </button>
                                <button type="button" className="rounded bg-white/10 px-3 py-1 text-sm" onClick={() => openLogs(row.id)}>
                                    Napló
                                </button>
                                <button type="button" className="rounded bg-red-800 px-3 py-1 text-sm" onClick={() => closeEvent(row.id)}>
                                    Lezárás
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <h2 className="mb-3 text-xl font-semibold">Korábbi események</h2>
                <div className="space-y-3">
                    {past.slice(0, 30).map((row) => (
                        <div key={row.id} className="rounded-xl bg-gray-800/70 p-4 text-sm">
                            <p className="font-medium">
                                {row.name} · {row.status}
                            </p>
                            <p className="text-gray-400">
                                {new Date(row.startsAt).toLocaleString("hu-HU")} – {new Date(row.endsAt).toLocaleString("hu-HU")}
                                {row.createdByName ? ` · ${row.createdByName}` : ""}
                            </p>
                            <button type="button" className="mt-2 text-yellow-300 underline" onClick={() => openLogs(row.id)}>
                                Napló
                            </button>
                        </div>
                    ))}
                </div>

                {selected && (
                    <div className="mt-8 rounded-xl bg-gray-800 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Napló: {selected.name}</h3>
                            <button type="button" className="text-sm text-gray-400" onClick={() => setSelected(null)}>
                                Bezárás
                            </button>
                        </div>
                        <ul className="space-y-2 text-sm">
                            {(selected.logs || []).map((log) => (
                                <li key={log.id} className="border-b border-white/5 pb-2">
                                    <span className="text-yellow-200">{log.action}</span>
                                    {log.actorName ? ` · ${log.actorName}` : ""}
                                    {log.createdAt ? ` · ${new Date(log.createdAt).toLocaleString("hu-HU")}` : ""}
                                    {log.description ? ` — ${log.description}` : ""}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

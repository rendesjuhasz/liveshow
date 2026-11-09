"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { useT } from "@/lib/i18n/I18nProvider";

type ContactStatus = "new" | "opened" | "replied";

type ContactRow = {
    id: string;
    name: string;
    email: string;
    message: string;
    preview: string;
    status: ContactStatus | string;
    adminNote: string;
    createdAt: string;
};

type ListPayload = {
    items: ContactRow[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
};

const STATUS_FILTERS: { id: "all" | ContactStatus; label: string }[] = [
    { id: "all", label: "Összes" },
    { id: "new", label: "Új" },
    { id: "opened", label: "Megnyitott" },
    { id: "replied", label: "Válaszolt" },
];

const STATUS_LABEL: Record<string, string> = {
    new: "Új",
    opened: "Megnyitott",
    replied: "Válaszolt",
};

const STATUS_CLASS: Record<string, string> = {
    new: "bg-amber-500/20 text-amber-200",
    opened: "bg-sky-500/20 text-sky-200",
    replied: "bg-emerald-500/20 text-emerald-200",
};

export default function AdminContactPage() {
    const { formatDateTime } = useT();
    const gate = useAdminGate();
    const [data, setData] = useState<ListPayload>({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        pageCount: 1,
    });
    const [status, setStatus] = useState<"all" | ContactStatus>("all");
    const [q, setQ] = useState("");
    const [qDebounced, setQDebounced] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [openId, setOpenId] = useState<string | null>(null);
    const [noteDraft, setNoteDraft] = useState("");
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState("");

    useEffect(() => {
        const t = setTimeout(() => setQDebounced(q), 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        setPage(1);
    }, [status, qDebounced, pageSize]);

    const load = useCallback(async () => {
        const params = new URLSearchParams({
            status,
            page: String(page),
            pageSize: String(pageSize),
        });
        if (qDebounced.trim()) params.set("q", qDebounced.trim());
        const payload = await apiFetch(`/admin/contact?${params}`);
        setData({
            items: Array.isArray(payload?.items) ? payload.items : [],
            total: Number(payload?.total || 0),
            page: Number(payload?.page || 1),
            pageSize: Number(payload?.pageSize || pageSize),
            pageCount: Number(payload?.pageCount || 1),
        });
    }, [status, page, pageSize, qDebounced]);

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err) => setError(err.message || "Betöltés sikertelen."));
    }, [gate.ok, load]);

    function patchLocal(updated: ContactRow) {
        setData((prev) => ({
            ...prev,
            items: prev.items.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
        }));
    }

    async function patch(id: string, body: { status?: ContactStatus; adminNote?: string }) {
        setError("");
        setBusyId(id);
        try {
            const updated = await apiFetch(`/admin/contact/${id}`, {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            patchLocal(updated);
            if (status !== "all" && body.status && body.status !== status) {
                await load();
            }
            return updated as ContactRow;
        } catch (err: any) {
            setError(err.message || "A mentés nem sikerült.");
            throw err;
        } finally {
            setBusyId("");
        }
    }

    async function openRow(row: ContactRow) {
        if (openId === row.id) {
            setOpenId(null);
            return;
        }
        setOpenId(row.id);
        setNoteDraft(row.adminNote || "");
        if (row.status === "new") {
            try {
                const updated = await patch(row.id, { status: "opened" });
                setNoteDraft(updated.adminNote || "");
            } catch {
                /* error already shown */
            }
        }
    }

    async function saveNote(row: ContactRow) {
        try {
            await patch(row.id, { adminNote: noteDraft });
        } catch {
            /* error already shown */
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    const pages = pageNumbers(data.page, data.pageCount);

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="mx-auto max-w-6xl">
                <h1 className="mb-2 text-3xl font-bold">Kapcsolat üzenetek</h1>
                <p className="mb-6 text-gray-400">
                    Belső admin lista. A megjegyzést a felhasználó nem látja. Választ innen nem küld a
                    rendszer.
                </p>
                {error && <p className="mb-4 text-red-400">{error}</p>}

                <div className="mb-4 flex flex-wrap gap-2">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={`rounded-lg px-3 py-2 text-sm ${
                                status === f.id ? "bg-blue-600" : "bg-gray-800"
                            }`}
                            onClick={() => setStatus(f.id)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <input
                        className="w-full max-w-md rounded p-3 text-black"
                        placeholder="Keresés név, email vagy üzenet szerint"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        Oldalanként
                        <select
                            className="rounded bg-gray-800 p-2"
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </label>
                    <p className="text-sm text-gray-400">{data.total} üzenet</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-700">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-800 text-gray-300">
                            <tr>
                                <th className="px-3 py-2 font-medium">Státusz</th>
                                <th className="px-3 py-2 font-medium">Név</th>
                                <th className="px-3 py-2 font-medium">Email</th>
                                <th className="px-3 py-2 font-medium">Beküldve</th>
                                <th className="px-3 py-2 font-medium">Előnézet</th>
                                <th className="px-3 py-2 font-medium">Megnyitás</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((row) => {
                                const open = openId === row.id;
                                return (
                                    <Fragment key={row.id}>
                                        <tr className="border-t border-gray-700 align-top">
                                            <td className="px-3 py-3">
                                                <select
                                                    aria-label="Státusz"
                                                    className={`rounded px-2 py-1 ${STATUS_CLASS[row.status] || "bg-gray-800"}`}
                                                    value={isKnownStatus(row.status) ? row.status : "new"}
                                                    disabled={busyId === row.id}
                                                    onChange={(e) =>
                                                        patch(row.id, { status: e.target.value as ContactStatus })
                                                    }
                                                >
                                                    <option value="new">{STATUS_LABEL.new}</option>
                                                    <option value="opened">{STATUS_LABEL.opened}</option>
                                                    <option value="replied">{STATUS_LABEL.replied}</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-3 font-medium">{row.name}</td>
                                            <td className="px-3 py-3">
                                                <a className="text-blue-300" href={`mailto:${row.email}`}>
                                                    {row.email}
                                                </a>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-gray-400">
                                                {row.createdAt
                                                    ? formatDateTime(row.createdAt)
                                                    : ""}
                                            </td>
                                            <td className="max-w-xs px-3 py-3 text-gray-300">{row.preview}</td>
                                            <td className="px-3 py-3">
                                                <button
                                                    type="button"
                                                    className="rounded bg-gray-700 px-3 py-1"
                                                    onClick={() => openRow(row)}
                                                >
                                                    {open ? "Bezár" : "Megnyitás"}
                                                </button>
                                            </td>
                                        </tr>
                                        {open && (
                                            <tr className="border-t border-gray-800 bg-gray-800/60">
                                                <td colSpan={6} className="px-3 py-4">
                                                    <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                                                        Üzenet
                                                    </p>
                                                    <p className="mb-4 whitespace-pre-wrap text-gray-100">
                                                        {row.message}
                                                    </p>
                                                    <label className="grid gap-1 text-sm">
                                                        Belső admin megjegyzés
                                                        <textarea
                                                            className="min-h-24 rounded p-2 text-black"
                                                            value={noteDraft}
                                                            onChange={(e) => setNoteDraft(e.target.value)}
                                                            maxLength={2000}
                                                            placeholder="Pl. Bugból ered. / Visszahívni. / Választ küldtünk e-mailben."
                                                        />
                                                    </label>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            className="rounded bg-blue-600 px-3 py-2"
                                                            disabled={busyId === row.id}
                                                            onClick={() => saveNote(row)}
                                                        >
                                                            Megjegyzés mentése
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded bg-emerald-700 px-3 py-2"
                                                            disabled={busyId === row.id}
                                                            onClick={() => patch(row.id, { status: "replied" })}
                                                        >
                                                            Megjelölés: Válaszolt
                                                        </button>
                                                    </div>
                                                    {row.adminNote ? (
                                                        <p className="mt-3 text-sm text-gray-400">
                                                            Utoljára mentett: {row.adminNote}
                                                        </p>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                            {data.items.length === 0 && !error && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-gray-400">
                                        Nincs ilyen üzenet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="rounded bg-gray-800 px-3 py-2 disabled:opacity-40"
                        disabled={data.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Előző
                    </button>
                    {pages.map((n, i) =>
                        n === "…" ? (
                            <span key={`gap-${i}`} className="px-1 text-gray-500">
                                …
                            </span>
                        ) : (
                            <button
                                key={n}
                                type="button"
                                className={`rounded px-3 py-2 ${
                                    n === data.page ? "bg-blue-600" : "bg-gray-800"
                                }`}
                                onClick={() => setPage(n)}
                            >
                                {n}
                            </button>
                        ),
                    )}
                    <button
                        type="button"
                        className="rounded bg-gray-800 px-3 py-2 disabled:opacity-40"
                        disabled={data.page >= data.pageCount}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Következő
                    </button>
                    <span className="ml-2 text-sm text-gray-400">
                        {data.page} / {data.pageCount} oldal
                    </span>
                </div>

                <a href="/admin" className="mt-8 block text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

function isKnownStatus(status: string): status is ContactStatus {
    return status === "new" || status === "opened" || status === "replied";
}

function pageNumbers(current: number, total: number): Array<number | "…"> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
    const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const out: Array<number | "…"> = [];
    let prev = 0;
    for (const n of nums) {
        if (prev && n > prev + 1) out.push("…");
        out.push(n);
        prev = n;
    }
    return out;
}

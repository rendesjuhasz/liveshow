"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/api/http";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { LOCALES } from "@/lib/i18n/messages";

export default function AdminI18nPage() {
    const { user, ready } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [languages, setLanguages] = useState<any[]>([]);
    const [filter, setFilter] = useState("");
    const [edit, setEdit] = useState({ key: "", locale: "en", value: "", status: "approved" });
    const [newLang, setNewLang] = useState({ code: "", name: "", nativeName: "" });
    const [versions, setVersions] = useState<any[]>([]);
    const [message, setMessage] = useState("");

    function reload() {
        apiFetch("/admin/i18n/stats").then(setStats).catch(() => setStats(null));
        apiFetch("/admin/i18n/translations").then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]));
        apiFetch("/admin/i18n/languages").then((d) => setLanguages(Array.isArray(d) ? d : [])).catch(() => setLanguages([]));
    }

    useEffect(() => {
        if (!ready || !user || !isAdmin(user)) return;
        reload();
    }, [ready, user]);

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return rows.slice(0, 80);
        return rows.filter((r) => `${r.key} ${r.locale} ${r.value}`.toLowerCase().includes(q)).slice(0, 80);
    }, [filter, rows]);

    if (!ready) return <p className="p-8 text-white">Betöltés...</p>;
    if (!user || !isAdmin(user)) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-6xl space-y-8">
                <h1 className="text-3xl font-bold">Nyelvek és fordítások</h1>
                {message && <p className="text-emerald-400">{message}</p>}

                <section className="rounded-xl bg-gray-800 p-5">
                    <h2 className="mb-3 text-xl font-semibold">Lefedettség</h2>
                    <p className="mb-3 text-sm text-gray-400">Katalógus kulcsok: {stats?.catalogKeys ?? 0}</p>
                    <div className="grid gap-3 md:grid-cols-3">
                        {(stats?.coverage || []).map((c: any) => (
                            <div key={c.locale} className="rounded-lg border border-white/10 p-3">
                                <p className="font-bold uppercase">{c.locale}</p>
                                <p>{c.approved} jóváhagyva · {c.percent}%</p>
                            </div>
                        ))}
                    </div>
                    {(stats?.missing || []).length > 0 && (
                        <div className="mt-4">
                            <h3 className="mb-2 font-semibold text-yellow-300">Hiányzó / jelentett kulcsok</h3>
                            <ul className="space-y-1 text-sm text-yellow-100">
                                {stats.missing.map((m: any) => (
                                    <li key={`${m.key}-${m.locale}`}>
                                        {m.key} · {m.locale} · {m.hits} találat
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                <section className="rounded-xl bg-gray-800 p-5">
                    <h2 className="mb-3 text-xl font-semibold">Nyelvek</h2>
                    <ul className="mb-4 space-y-2">
                        {languages.map((lang) => (
                            <li key={lang.code} className="flex items-center justify-between gap-3 rounded-lg bg-black/30 px-3 py-2">
                                <span>
                                    {lang.nativeName} ({lang.code}) {lang.isDefault ? "· alap" : ""}
                                </span>
                                <button
                                    type="button"
                                    className="text-sm text-yellow-300"
                                    onClick={async () => {
                                        await apiFetch(`/admin/i18n/languages/${lang.code}`, {
                                            method: "PATCH",
                                            body: JSON.stringify({ enabled: !lang.enabled }),
                                        });
                                        reload();
                                    }}
                                >
                                    {lang.enabled ? "Tiltás" : "Engedélyezés"}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <form
                        className="flex flex-wrap gap-2"
                        onSubmit={async (e) => {
                            e.preventDefault();
                            await apiFetch("/admin/i18n/languages", {
                                method: "POST",
                                body: JSON.stringify(newLang),
                            });
                            setNewLang({ code: "", name: "", nativeName: "" });
                            setMessage("Nyelv mentve. A UI szövegekhez add hozzá a kulcsokat.");
                            reload();
                        }}
                    >
                        <input className="rounded bg-gray-700 p-2" placeholder="kód (pl. pl)" value={newLang.code} onChange={(e) => setNewLang({ ...newLang, code: e.target.value })} />
                        <input className="rounded bg-gray-700 p-2" placeholder="angol név" value={newLang.name} onChange={(e) => setNewLang({ ...newLang, name: e.target.value })} />
                        <input className="rounded bg-gray-700 p-2" placeholder="saját név" value={newLang.nativeName} onChange={(e) => setNewLang({ ...newLang, nativeName: e.target.value })} />
                        <button className="rounded bg-blue-600 px-4 py-2" type="submit">Nyelv hozzáadása</button>
                    </form>
                </section>

                <section className="rounded-xl bg-gray-800 p-5">
                    <h2 className="mb-3 text-xl font-semibold">Fordítás szerkesztése</h2>
                    <form
                        className="grid gap-2 md:grid-cols-2"
                        onSubmit={async (e) => {
                            e.preventDefault();
                            await apiFetch("/admin/i18n/translations", {
                                method: "POST",
                                body: JSON.stringify(edit),
                            });
                            setMessage("Fordítás mentve.");
                            reload();
                        }}
                    >
                        <input className="rounded bg-gray-700 p-2" placeholder="kulcs" value={edit.key} onChange={(e) => setEdit({ ...edit, key: e.target.value })} />
                        <select className="rounded bg-gray-700 p-2" value={edit.locale} onChange={(e) => setEdit({ ...edit, locale: e.target.value })}>
                            {LOCALES.map((code) => (
                                <option key={code} value={code}>{code}</option>
                            ))}
                        </select>
                        <textarea className="md:col-span-2 rounded bg-gray-700 p-2" rows={3} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} />
                        <select className="rounded bg-gray-700 p-2" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                            <option value="draft">vázlat</option>
                            <option value="approved">jóváhagyva</option>
                        </select>
                        <div className="flex gap-2">
                            <button className="rounded bg-green-600 px-4 py-2" type="submit">Mentés</button>
                            <button
                                className="rounded bg-yellow-600 px-4 py-2"
                                type="button"
                                onClick={async () => {
                                    await apiFetch("/admin/i18n/translations/approve", {
                                        method: "POST",
                                        body: JSON.stringify({ key: edit.key, locale: edit.locale }),
                                    });
                                    setMessage("Jóváhagyva.");
                                    reload();
                                }}
                            >
                                Jóváhagyás
                            </button>
                            <button
                                className="rounded bg-gray-600 px-4 py-2"
                                type="button"
                                onClick={async () => {
                                    const data = await apiFetch(`/admin/i18n/versions?key=${encodeURIComponent(edit.key)}&locale=${edit.locale}`);
                                    setVersions(Array.isArray(data) ? data : []);
                                }}
                            >
                                Verziók
                            </button>
                        </div>
                    </form>
                    {versions.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-gray-300">
                            {versions.map((v) => (
                                <li key={v.id}>{v.createdAt} · {v.status} · {v.value}</li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="rounded-xl bg-gray-800 p-5">
                    <h2 className="mb-3 text-xl font-semibold">Kulcslista</h2>
                    <input className="mb-3 w-full rounded bg-gray-700 p-2" placeholder="szűrés" value={filter} onChange={(e) => setFilter(e.target.value)} />
                    <div className="max-h-[480px] overflow-auto text-sm">
                        {filtered.map((row) => (
                            <button
                                type="button"
                                key={`${row.key}-${row.locale}`}
                                className="block w-full border-b border-white/5 px-2 py-2 text-left hover:bg-white/5"
                                onClick={() => setEdit({ key: row.key, locale: row.locale, value: row.value, status: row.status })}
                            >
                                <span className="font-mono text-yellow-200">{row.key}</span> · {row.locale} · {row.status}
                                <span className="block text-gray-400">{row.value}</span>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

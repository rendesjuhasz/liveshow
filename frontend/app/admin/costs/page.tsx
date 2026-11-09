"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { useT } from "@/lib/i18n/I18nProvider";

function ft(n: number | undefined, money: (amount: number) => string) {
    return money(Math.round(Number(n) || 0));
}

function gb(bytes?: number) {
    const b = Number(bytes) || 0;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const RATE_FIELDS: { key: string; label: string; hint: string }[] = [
    { key: "storageGbMonthFt", label: "Tárhely Ft / GB / hó", hint: "uploads + output + backup + outbox" },
    { key: "cdnMonthlyFt", label: "CDN Ft / hó", hint: "Ma nincs CDN a kódban — 0, amíg nem fizetsz egyet" },
    { key: "transcodeHourFt", label: "Transzkód Ft / óra", hint: "Helyi FFmpeg: 0, ha a VPS díjban van" },
    { key: "serverMonthlyFt", label: "Szerver Ft / hó", hint: "VPS számla (CPU/RAM, ami az FFmpeg-et is viszi)" },
    { key: "dbMonthlyFt", label: "Adatbázis Ft / hó", hint: "0 = ugyanaz a gép; managed Postgres külön" },
    { key: "emailPerThousandFt", label: "E-mail Ft / 1000 levél", hint: "SMTP / Resend / SES díjszabás" },
    { key: "budgetMonthlyFt", label: "Havi költségkeret Ft", hint: "Opcionális riasztási küszöb" },
];

export default function AdminCostsPage() {
    const { formatMoney } = useT();
    const gate = useAdminGate();
    const [data, setData] = useState<any>(null);
    const [rates, setRates] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [saved, setSaved] = useState("");

    const load = useCallback(() => {
        return apiFetch("/admin/costs")
            .then((row) => {
                setData(row);
                const next: Record<string, string> = {};
                for (const field of RATE_FIELDS) {
                    next[field.key] = String(row?.rates?.[field.key] ?? 0);
                }
                setRates(next);
            })
            .catch((err: any) => setError(err.message || "A költségek nem tölthetők be."));
    }, []);

    useEffect(() => {
        if (!gate.ok) return;
        void load();
    }, [gate.ok, load]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    async function save(e: { preventDefault: () => void }) {
        e.preventDefault();
        setError("");
        setSaved("");
        const body: Record<string, number> = {};
        for (const field of RATE_FIELDS) {
            body[field.key] = Number(rates[field.key] || 0);
        }
        try {
            const row = await apiFetch("/admin/costs", { method: "PUT", body: JSON.stringify(body) });
            setData(row);
            setSaved("Árak mentve.");
        } catch (err: any) {
            setError(err.message || "A mentés sikertelen.");
        }
    }

    const costs = data?.costs || {};
    const usage = data?.usage || {};
    const revenue = data?.revenue || {};

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-5xl">
                <a href="/admin" className="text-sm text-yellow-300 underline">
                    ← Vissza az adminhoz
                </a>
                <h1 className="mt-4 mb-2 text-3xl font-bold">Költségmonitorozás</h1>
                <p className="mb-6 text-gray-400">
                    Hónap: {data?.month || "—"}. A hat tétel külön. A platform jutalék a tartalomkészítőnek járó
                    részt nem fedezi — csak a jutalékot hasonlítjuk a számlákhoz.
                </p>
                {error && <p className="mb-4 text-red-400">{error}</p>}
                {saved && <p className="mb-4 text-green-400">{saved}</p>}

                {!data?.ratesFilled && (
                    <p className="mb-4 rounded-xl border border-yellow-600 bg-yellow-900/40 p-4 text-yellow-200">
                        Még nincs kitöltött Ft-ár. Használat már látszik, de a „nyereség” hamis, amíg a VPS /
                        SMTP / tárhely díját be nem írod.
                    </p>
                )}
                {data?.loss && (
                    <p className="mb-4 rounded-xl border border-red-600 bg-red-900/40 p-4 text-red-200">
                        Veszteség ebben a hónapban: a becsült üzemeltetés ({ft(data.total, formatMoney)}) nagyobb, mint a
                        platform jutalék ({ft(revenue.platformCommission, formatMoney)}).
                    </p>
                )}
                {data?.overBudget && (
                    <p className="mb-4 rounded-xl border border-orange-600 bg-orange-900/40 p-4 text-orange-200">
                        Túllépted a havi keretet ({ft(data.rates?.budgetMonthlyFt, formatMoney)}).
                    </p>
                )}

                <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Becsült üzemeltetés</p>
                        <p className="text-2xl font-bold">{ft(data?.total, formatMoney)}</p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Platform jutalék (hó)</p>
                        <p className="text-2xl font-bold">{ft(revenue.platformCommission, formatMoney)}</p>
                        <p className="text-xs text-gray-500">
                            Bruttó {ft(revenue.gross, formatMoney)} · {revenue.commissionPercent ?? 0}%
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Marzs (jutalék − költség)</p>
                        <p className={`text-2xl font-bold ${(data?.margin || 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                            {ft(data?.margin, formatMoney)}
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Tartalomkészítőnek (hó)</p>
                        <p className="text-2xl font-bold">{ft(revenue.streamerNet, formatMoney)}</p>
                        <p className="text-xs text-gray-500">Ez nem a tied — payout</p>
                    </div>
                </div>

                <h2 className="mb-3 text-xl font-semibold">Havi költségek tételenként</h2>
                <ul className="mb-8 space-y-2 text-sm">
                    {[
                        ["Tárhely", costs.storage, gb(usage.storageBytes)],
                        ["CDN", costs.cdn, usage.cdn?.note],
                        [
                            "Transzkódolás",
                            costs.transcode,
                            `${usage.transcodeHoursEst ?? 0} ó (élő ${usage.liveHoursNow ?? 0} + ${usage.archivesThisMonth ?? 0} archív × 0,3)`,
                        ],
                        ["Szerver", costs.server, "VPS"],
                        ["Adatbázis", costs.database, "Postgres"],
                        ["E-mail", costs.email, `${usage.emailsThisMonth ?? 0} levél ebben a hónapban`],
                    ].map(([label, amount, hint]) => (
                        <li key={String(label)} className="flex flex-wrap justify-between gap-2 rounded-xl bg-gray-800 p-3">
                            <span>
                                {label}
                                {hint ? <span className="block text-gray-400">{hint}</span> : null}
                            </span>
                            <span className="font-semibold">{ft(amount as number, formatMoney)}</span>
                        </li>
                    ))}
                </ul>

                <h2 className="mb-3 text-xl font-semibold">Tárhely bontás</h2>
                <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {["uploads", "output", "backups", "mailOutbox"].map((key) => (
                        <div key={key} className="rounded-xl bg-gray-800 p-4">
                            <p className="text-sm text-gray-400">{key}</p>
                            <p className="font-semibold">{gb(usage.storageByFolder?.[key])}</p>
                        </div>
                    ))}
                </div>

                {(usage.emailsByType || []).length > 0 && (
                    <>
                        <h2 className="mb-3 text-xl font-semibold">E-mailek típus szerint</h2>
                        <ul className="mb-8 space-y-2 text-sm">
                            {usage.emailsByType.map((row: any) => (
                                <li key={row.type} className="flex justify-between rounded-xl bg-gray-800 p-3">
                                    <span>{row.type}</span>
                                    <span>{row.count}</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                <h2 className="mb-3 text-xl font-semibold">Egységárak</h2>
                <form onSubmit={(e) => void save(e)} className="space-y-3">
                    {RATE_FIELDS.map((field) => (
                        <label key={field.key} className="block rounded-xl bg-gray-800 p-4">
                            <span className="text-sm font-semibold">{field.label}</span>
                            <p className="mb-2 text-xs text-gray-400">{field.hint}</p>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-full rounded-lg bg-gray-900 p-2"
                                value={rates[field.key] ?? "0"}
                                onChange={(e) => setRates((prev) => ({ ...prev, [field.key]: e.target.value }))}
                            />
                        </label>
                    ))}
                    <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700">
                        Árak mentése
                    </button>
                </form>

                {(data?.notes || []).length > 0 && (
                    <ul className="mt-8 list-disc space-y-1 pl-5 text-sm text-gray-400">
                        {data.notes.map((line: string) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

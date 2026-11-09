"use client";

import { useEffect, useState } from "react";
import { apiDownload, apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { payoutStatusClass, payoutStatusLabel } from "@/lib/payout-status";
import { useT } from "@/lib/i18n/I18nProvider";

export default function AdminPaymentsPage() {
    const { formatDateTime } = useT();
    const gate = useAdminGate();
    const [payments, setPayments] = useState<any[]>([]);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [groupReport, setGroupReport] = useState<any[]>([]);
    const [streamers, setStreamers] = useState<any[]>([]);
    const [streamerId, setStreamerId] = useState("");
    const [amount, setAmount] = useState("");
    const [percent, setPercent] = useState("20");
    const [streamerPercent, setStreamerPercent] = useState("80");
    const [cycle, setCycle] = useState("monthly");
    const [payMethod, setPayMethod] = useState("bank_transfer");
    const [error, setError] = useState("");

    async function load() {
        const [pay, out, people, commission, groups] = await Promise.all([
            apiFetch("/payments"),
            apiFetch("/admin/payouts"),
            apiFetch("/admin/streamers"),
            apiFetch("/admin/commission"),
            apiFetch("/admin/ticket-group-report").catch(() => []),
        ]);
        setPayments(Array.isArray(pay) ? pay : []);
        setPayouts(Array.isArray(out) ? out : []);
        setStreamers(Array.isArray(people) ? people : []);
        setGroupReport(Array.isArray(groups) ? groups : []);
        if (commission?.commissionPercent != null) {
            setPercent(String(commission.commissionPercent));
            setStreamerPercent(String(commission.streamerPercent ?? 100 - commission.commissionPercent));
        }
        if (commission?.payoutCycle) setCycle(commission.payoutCycle);
    }

    useEffect(() => {
        if (gate.ok) load().catch((err: any) => setError(err.message || "Betöltési hiba."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Kifizetések</h1>
                {error && <p className="text-red-400 mb-4">{error}</p>}

                <form
                    className="bg-gray-800 p-4 rounded-xl mb-8 flex flex-wrap gap-3 items-end"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        try {
                            const data = await apiFetch("/admin/commission", {
                                method: "PUT",
                                body: JSON.stringify({
                                    commissionPercent: Number(percent),
                                    streamerPercent: Number(streamerPercent),
                                    payoutCycle: cycle,
                                }),
                            });
                            setPercent(String(data.commissionPercent));
                            setStreamerPercent(String(data.streamerPercent));
                            setCycle(data.payoutCycle);
                        } catch (err: any) {
                            setError(err.message || "A jutalék mentése nem sikerült.");
                        }
                    }}
                >
                    <label className="grid gap-1">
                        Platform részesedés (%)
                        <input
                            className="p-2 text-black rounded w-28"
                            type="number"
                            min={0}
                            max={90}
                            value={percent}
                            onChange={(e) => {
                                setPercent(e.target.value);
                                const n = Number(e.target.value);
                                if (Number.isFinite(n)) setStreamerPercent(String(100 - n));
                            }}
                        />
                    </label>
                    <label className="grid gap-1">
                        Tartalomkészítő részesedés (%)
                        <input
                            className="p-2 text-black rounded w-28"
                            type="number"
                            min={10}
                            max={100}
                            value={streamerPercent}
                            onChange={(e) => {
                                setStreamerPercent(e.target.value);
                                const n = Number(e.target.value);
                                if (Number.isFinite(n)) setPercent(String(100 - n));
                            }}
                        />
                    </label>
                    <label className="grid gap-1">
                        Kifizetési ciklus
                        <select className="p-2 text-black rounded" value={cycle} onChange={(e) => setCycle(e.target.value)}>
                            <option value="weekly">Heti</option>
                            <option value="monthly">Havi</option>
                            <option value="per_show">Műsoronként</option>
                        </select>
                    </label>
                    <button className="bg-blue-600 px-4 py-2 rounded">Beállítások mentése</button>
                    <p className="text-sm text-gray-400 w-full">
                        A nettó automatikusan számolódik: felhasznált jegyek × jegyérték − platform %. Műsoronként a
                        műsor szerkesztőben eltérő platform % adható.
                    </p>
                </form>

                <h2 className="text-xl font-semibold mb-2">Jegycsoport bevétel tartalomkészítőnként</h2>
                <ul className="mb-8 space-y-4">
                    {groupReport.length === 0 && (
                        <li className="text-gray-400 text-sm">Még nincs jegyköltés.</li>
                    )}
                    {groupReport.map((row) => (
                        <li key={row.streamerId} className="bg-gray-800 p-4 rounded-xl text-sm">
                            <p className="font-semibold mb-2">Tartalomkészítő: {row.streamerName}</p>
                            <p className="text-gray-400 mb-2">
                                Fizetett jegy: {row.paidTicketsSpent ?? row.totalTicketsSpent} · ajándékjegy:{" "}
                                {row.giftTicketsSpent ?? 0} · jóváírás: {row.totalCredited} Ft
                            </p>
                            <ul className="grid sm:grid-cols-2 gap-2">
                                {(row.groups || []).map((g: any) => (
                                    <li key={g.key || g.name}>
                                        {g.name}: {g.ticketsSpent} db jegy · {g.creditedAmount} Ft
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-2">Jegyfizetések</h2>
                <ul className="mb-8 space-y-2 text-sm">
                    {payments.length === 0 && <li className="text-gray-400">Nincs jegyfizetés.</li>}
                    {payments.map((p) => (
                        <li key={p.id} className="bg-gray-800 p-3 rounded">
                            {p.user?.email} · {p.ticket?.show?.title} · {p.amount} Ft · {p.status} · {p.provider}
                            {p.status === "paid" && (
                                <button
                                    type="button"
                                    className="ml-3 text-red-300 underline"
                                    onClick={async () => {
                                        if (!confirm("Visszatéríted ezt a fizetést?")) return;
                                        try {
                                            await apiFetch(`/payments/${p.id}/refund`, { method: "POST" });
                                            await load();
                                        } catch (err: any) {
                                            setError(err.message || "A visszatérítés nem sikerült.");
                                        }
                                    }}
                                >
                                    Visszatérítés
                                </button>
                            )}
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-2">Tartalomkészítő kifizetések</h2>
                <p className="text-gray-400 text-sm mb-3">
                    Státusz: függőben → folyamatban (jóváhagyás) → kifizetve. Minden lépés naplózott.
                </p>
                <form
                    className="flex flex-wrap gap-2 mb-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        try {
                            await apiFetch("/admin/payouts", {
                                method: "POST",
                                body: JSON.stringify({ streamerId, amount: Number(amount) }),
                            });
                            setAmount("");
                            await load();
                        } catch (err: any) {
                            setError(err.message || "Nem sikerült létrehozni.");
                        }
                    }}
                >
                    <select
                        className="p-2 text-black rounded"
                        value={streamerId}
                        onChange={(e) => setStreamerId(e.target.value)}
                        required
                    >
                        <option value="">Tartalomkészítő</option>
                        {streamers.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                    <input
                        className="p-2 text-black rounded w-32"
                        placeholder="Összeg"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                    <button className="bg-blue-600 px-4 rounded">Igénylés létrehozása</button>
                </form>
                <label className="grid gap-1 text-sm mb-4 max-w-xs">
                    Kifizetés módja (kifizetve státusznál)
                    <select className="p-2 text-black rounded" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                        <option value="bank_transfer">Banki átutalás</option>
                        <option value="other">Egyéb</option>
                    </select>
                </label>
                <ul className="space-y-2 text-sm">
                    {payouts.map((p) => (
                        <li key={p.id} className="bg-gray-800 p-3 rounded">
                            <div className="flex flex-wrap justify-between gap-3">
                                <span>
                                    {p.streamer?.name || p.streamerName} · {p.amount} Ft ·{" "}
                                    <span className={payoutStatusClass(p.status)}>{payoutStatusLabel(p.status)}</span>
                                    {p.method ? ` · ${p.method}` : ""}
                                    <span className="text-gray-500">
                                        {" "}
                                        · igényelve {p.createdAt ? formatDateTime(p.createdAt) : "—"}
                                        {p.paidAt ? ` · kifizetve ${formatDateTime(p.paidAt)}` : ""}
                                    </span>
                                </span>
                                <span className="flex gap-3">
                                    <button
                                        type="button"
                                        className="text-blue-300"
                                        onClick={() =>
                                            apiDownload(`/admin/payouts/${p.id}/receipt`, `kifizetes-${p.id.slice(0, 8)}.html`)
                                        }
                                    >
                                        Bizonylat
                                    </button>
                                    {p.status === "pending" && (
                                        <button
                                            type="button"
                                            className="text-yellow-400"
                                            onClick={async () => {
                                                try {
                                                    await apiFetch(`/admin/payouts/${p.id}/approve`, { method: "POST" });
                                                    await load();
                                                } catch (err: any) {
                                                    setError(err.message);
                                                }
                                            }}
                                        >
                                            Folyamatba
                                        </button>
                                    )}
                                    {p.status === "approved" && (
                                        <button
                                            type="button"
                                            className="text-green-400"
                                            onClick={async () => {
                                                try {
                                                    await apiFetch(`/admin/payouts/${p.id}/paid`, {
                                                        method: "POST",
                                                        body: JSON.stringify({ method: payMethod }),
                                                    });
                                                    await load();
                                                } catch (err: any) {
                                                    setError(err.message);
                                                }
                                            }}
                                        >
                                            Kifizetettnek jelölés
                                        </button>
                                    )}
                                </span>
                            </div>
                            {(p.snapshot?.shows || []).length > 0 && (
                                <ul className="mt-2 text-gray-400">
                                    {p.snapshot.shows.slice(0, 8).map((s: any, i: number) => (
                                        <li key={i}>
                                            {s.title}: {s.tickets} jegy · nettó {s.net} Ft
                                        </li>
                                    ))}
                                </ul>
                            )}
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

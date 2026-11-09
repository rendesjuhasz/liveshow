"use client";

import { useEffect, useState } from "react";
import { apiDownload, apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { payoutStatusClass, payoutStatusLabel } from "@/lib/payout-status";
import { useT } from "@/lib/i18n/I18nProvider";

export default function StreamerPayoutsPage() {
    const { formatDateTime } = useT();
    const gate = useStreamerGate();
    const [rows, setRows] = useState<any[]>([]);
    const [revenue, setRevenue] = useState<any>(null);
    const [amount, setAmount] = useState("");
    const [error, setError] = useState("");

    async function load() {
        const [payouts, money] = await Promise.all([
            apiFetch("/streamer/payouts"),
            apiFetch("/streamer/revenue"),
        ]);
        setRows(Array.isArray(payouts) ? payouts : []);
        setRevenue(money);
        if (!amount && money?.available) setAmount(String(money.available));
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err: any) => setError(err.message || "Nem sikerült betölteni a kifizetéseket."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;

    const available = revenue?.available ?? 0;

    return (
        <StreamerShell title="Kifizetések">
            {revenue?.payoutDue?.label && (
                <p className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                    {revenue.payoutDue.label}
                </p>
            )}
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Kifizethető összeg</p>
                    <p className="text-xl font-bold">{available} Ft</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Függőben / folyamatban</p>
                    <p className="text-xl font-bold">
                        {(revenue?.pendingPayouts ?? 0) + (revenue?.approvedPayouts ?? 0)} Ft
                    </p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Korábban kifizetve</p>
                    <p className="text-xl font-bold">{revenue?.paidOut ?? 0} Ft</p>
                </div>
            </div>
            <form
                className="flex gap-3 mb-8 max-w-lg"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setError("");
                    try {
                        await apiFetch("/streamer/payouts", {
                            method: "POST",
                            body: JSON.stringify({ amount: Number(amount || available) }),
                        });
                        setAmount("");
                        await load();
                    } catch (err: any) {
                        setError(err.message || "Nem sikerült kérni a kifizetést.");
                    }
                }}
            >
                <input
                    className="p-3 rounded text-black flex-1"
                    type="number"
                    min={1}
                    max={available || undefined}
                    placeholder="Összeg (Ft)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />
                <button className="bg-yellow-500 text-black font-bold px-4 rounded-xl">
                    Kifizetés igénylése
                </button>
            </form>
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <h2 className="text-lg font-semibold mb-3">Kifizetési előzmények</h2>
            {rows.length === 0 && <p className="text-neutral-400">Még nincs kifizetési kérés.</p>}
            <ul className="space-y-2">
                {rows.map((p) => (
                    <li key={p.id} className="bg-neutral-900 p-3 rounded flex flex-wrap justify-between gap-3">
                        <span>
                            {p.amount} Ft
                            {p.method ? ` · ${p.method}` : ""}
                        </span>
                        <span className="flex items-center gap-3">
                            <span className={payoutStatusClass(p.status)}>
                                {payoutStatusLabel(p.status)} · {formatDateTime(p.createdAt)}
                            </span>
                            {(p.status === "paid" || p.status === "approved") && (
                                <button
                                    type="button"
                                    className="text-yellow-400 text-sm"
                                    onClick={() =>
                                        apiDownload(
                                            `/streamer/payouts/${p.id}/receipt`,
                                            `kifizetes-${p.id.slice(0, 8)}.html`,
                                        )
                                    }
                                >
                                    Bizonylat
                                </button>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </StreamerShell>
    );
}

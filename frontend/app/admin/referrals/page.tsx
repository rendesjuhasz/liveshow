"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { useT } from "@/lib/i18n/I18nProvider";

type Settings = {
    enabled: boolean;
    minimumPurchasedTickets: number;
    rewardTicketAmount: number;
    allowMultipleFromReferrer: boolean;
};

const STATUS_HU: Record<string, string> = {
    pending: "Függő",
    completed: "Teljesült",
    rewarded: "Jutalmazva",
};

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <div className="bg-gray-800 p-4 rounded-xl">
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
    );
}

export default function AdminReferralsPage() {
    const { formatDateTime } = useT();
    const gate = useAdminGate();
    const [settings, setSettings] = useState<Settings>({
        enabled: true,
        minimumPurchasedTickets: 10,
        rewardTicketAmount: 5,
        allowMultipleFromReferrer: true,
    });
    const [stats, setStats] = useState<any>(null);
    const [gifts, setGifts] = useState<any>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function load() {
        const [s, st, g, list] = await Promise.all([
            apiFetch("/admin/referrals/settings"),
            apiFetch("/admin/referrals/stats"),
            apiFetch("/admin/referrals/gifts"),
            apiFetch("/admin/referrals"),
        ]);
        setSettings({
            enabled: s?.enabled !== false,
            minimumPurchasedTickets: Number(s?.minimumPurchasedTickets) || 10,
            rewardTicketAmount: Number(s?.rewardTicketAmount) || 5,
            allowMultipleFromReferrer: s?.allowMultipleFromReferrer !== false,
        });
        setStats(st);
        setGifts(g);
        setRows(Array.isArray(list) ? list : []);
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err) => setError(err.message || "Betöltés sikertelen."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Ajánlóprogram</h1>
                <p className="text-gray-400 mb-6">
                    A jutalomjegyek a meglévő jegyegyenlegre kerülnek, nem számítanak eladásnak.
                </p>
                {error && <p className="text-red-400 mb-4">{error}</p>}
                {message && <p className="text-green-400 mb-4">{message}</p>}

                <form
                    className="bg-gray-800 p-4 rounded-xl mb-8 grid gap-3 md:grid-cols-2"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        setMessage("");
                        try {
                            await apiFetch("/admin/referrals/settings", {
                                method: "PATCH",
                                body: JSON.stringify({
                                    ...settings,
                                    minimumPurchasedTickets: Number(settings.minimumPurchasedTickets),
                                    rewardTicketAmount: Number(settings.rewardTicketAmount),
                                }),
                            });
                            setMessage("Beállítások mentve.");
                            await load();
                        } catch (err: any) {
                            setError(err.message || "Mentés sikertelen.");
                        }
                    }}
                >
                    <h2 className="md:col-span-2 text-xl font-semibold">Referral Settings</h2>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={settings.enabled}
                            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                        />
                        Ajánlóprogram bekapcsolva
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={settings.allowMultipleFromReferrer}
                            onChange={(e) =>
                                setSettings({ ...settings, allowMultipleFromReferrer: e.target.checked })
                            }
                        />
                        Több ajánlás ugyanattól a felhasználótól
                    </label>
                    <label className="grid gap-1 text-sm">
                        Minimum vásárolt jegy a jutalomhoz
                        <input
                            className="p-2 text-black rounded"
                            type="number"
                            min={1}
                            value={settings.minimumPurchasedTickets}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    minimumPurchasedTickets: Number(e.target.value),
                                })
                            }
                        />
                    </label>
                    <label className="grid gap-1 text-sm">
                        Jutalom jegy (ajánlónak)
                        <input
                            className="p-2 text-black rounded"
                            type="number"
                            min={1}
                            value={settings.rewardTicketAmount}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    rewardTicketAmount: Number(e.target.value),
                                })
                            }
                        />
                    </label>
                    <button className="md:col-span-2 bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-semibold">
                        Beállítások mentése
                    </button>
                </form>

                <h2 className="text-xl font-semibold mb-3">Ajánló statisztika</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card label="Összes ajánlás" value={stats?.total ?? 0} />
                    <Card label="Teljesült" value={stats?.completed ?? 0} />
                    <Card label="Jutalmazva" value={stats?.rewarded ?? 0} />
                    <Card label="Kiosztott jutalomjegy" value={stats?.rewardTicketsIssued ?? 0} />
                </div>

                <h2 className="text-xl font-semibold mb-3">Kiosztott ajándékjegy</h2>
                <p className="text-gray-500 text-sm mb-3">
                    Kampány, admin kiosztás és ajánló jutalom — nem számítanak jegycsomag-eladásnak.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card label="Összes kiosztott ajándékjegy" value={gifts?.totalGiftTicketsIssued ?? 0} />
                    <Card label="Admin ajándékjegy" value={gifts?.adminGiftTickets ?? 0} />
                    <Card label="Kampány" value={gifts?.campaignClaims ?? 0} />
                    <Card
                        label="Ajánló jutalom"
                        value={gifts?.referralRewardTickets ?? 0}
                        hint={`${gifts?.referralRewardPacks ?? 0} csomag`}
                    />
                </div>

                <h2 className="text-xl font-semibold mb-3">Ajánlások</h2>
                <div className="overflow-x-auto mb-8">
                    <table className="w-full text-sm">
                        <thead className="text-gray-400 text-left">
                            <tr>
                                <th className="p-2">Ajánló</th>
                                <th className="p-2">Ajánlott</th>
                                <th className="p-2">Státusz</th>
                                <th className="p-2">Vásárolt jegy</th>
                                <th className="p-2">Jutalom</th>
                                <th className="p-2">Dátum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-t border-gray-800">
                                    <td className="p-2">{r.referrerName || r.referrerEmail}</td>
                                    <td className="p-2">{r.referredName || r.referredEmail}</td>
                                    <td className="p-2">{STATUS_HU[r.status] || r.status}</td>
                                    <td className="p-2">{r.qualifyingPurchaseTickets}</td>
                                    <td className="p-2">{r.rewardTicketsGranted}</td>
                                    <td className="p-2">
                                        {r.createdAt ? formatDateTime(r.createdAt) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && <p className="text-gray-400 mt-3">Még nincs ajánlás.</p>}
                </div>

                <a href="/admin" className="block mt-8 text-blue-400">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}

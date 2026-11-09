"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { formatWatchDuration } from "@/lib/views";
import { useT } from "@/lib/i18n/I18nProvider";

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <div className="bg-gray-800 p-4 rounded-xl">
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
    );
}

export default function AdminStatsPage() {
    const { formatDateTime } = useT();
    const gate = useAdminGate();
    const [stats, setStats] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/admin/stats")
            .then(setStats)
            .catch((err: any) => setError(err.message || "A statisztika nem tölthető be."));
        const t = setInterval(() => {
            apiFetch("/admin/stats").then(setStats).catch(() => undefined);
        }, 20_000);
        return () => clearInterval(t);
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    const tickets = stats?.tickets || {};
    const revenue = stats?.revenue || {};
    const live = stats?.live || { now: 0, byShow: [] };
    const archives = stats?.archiveViews || { total: 0, byShow: [] };

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Statisztikák</h1>
                <p className="text-gray-400 mb-6">
                    Jegycsomagok, nézőszám, átlagos nézési idő, peak nézők és stream indulási hibák.
                </p>
                {error && <p className="text-red-400 mb-4">{error}</p>}

                <h2 className="text-xl font-semibold mb-3">Jegycsomag eladások</h2>
                <p className="text-gray-500 text-sm mb-3">
                    A 100 Ft-os Alap csomag és a többi jegycsomag. A régi teszt-műsorjegyek itt
                    már nem számítanak. Tartalomkészítő bevétel csak akkor, ha a jegyet kérdésre vagy
                    értékelésre felhasználták.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <Card label="Eladott jegyek" value={tickets.total ?? 0} hint={`${tickets.purchases ?? 0} csomag`} />
                    <Card label="Fizetett" value={tickets.paid ?? 0} />
                    <Card label="Függő csomag" value={tickets.pending ?? 0} />
                    <Card label="Felhasználók" value={stats?.users ?? 0} />
                </div>
                <ul className="mb-8 space-y-2 text-sm">
                    {(tickets.byCategory || []).map((c: any) => (
                        <li key={c.key} className="bg-gray-800 p-3 rounded flex justify-between">
                            <span>{c.name}</span>
                            <span>
                                {c.count} db · {c.revenue} Ft
                            </span>
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-3">Privát jegyvásárlások</h2>
                <p className="text-gray-500 text-sm mb-3">
                    A privát műsorajánlatból létrejött jegyek. Ezek nem jegycsomagok, külön fizetős
                    privát stream.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <Card label="Megvásárolt privát jegy" value={stats?.privateTickets?.paid ?? 0} />
                    <Card label="Fizetésre vár" value={stats?.privateTickets?.pending ?? 0} />
                    <Card
                        label="Privát jegy bevétel"
                        value={`${stats?.privateTickets?.revenue ?? 0} Ft`}
                    />
                    <Card
                        label="Ebből tartalomkészítőnek"
                        value={`${stats?.privateTickets?.streamerNet ?? 0} Ft`}
                        hint={`Jutalék ${stats?.privateTickets?.platformCommission ?? 0} Ft`}
                    />
                </div>
                <ul className="mb-8 space-y-2 text-sm">
                    {(stats?.privateTickets?.purchases || []).length === 0 && (
                        <li className="text-gray-400">Még nincs privát jegyvásárlás.</li>
                    )}
                    {(stats?.privateTickets?.purchases || []).map((row: any) => (
                        <li
                            key={row.ticketId || row.requestId}
                            className="bg-gray-800 p-3 rounded flex flex-wrap justify-between gap-2"
                        >
                            <span>
                                {row.topic || row.showTitle || "Privát műsor"}
                                {row.streamer ? ` · ${row.streamer}` : ""}
                                {row.viewerEmail ? ` · ${row.viewerEmail}` : ""}
                            </span>
                            <span>
                                {row.price} Ft ·{" "}
                                {row.ticketStatus === "active" || row.ticketStatus === "paid"
                                    ? "Fizetve"
                                    : row.ticketStatus === "pending"
                                      ? "Fizetésre vár"
                                      : row.ticketStatus || row.requestStatus}
                            </span>
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-3">Kiosztott ajándékjegy</h2>
                <p className="text-gray-500 text-sm mb-3">
                    Ingyenes jegyek: admin kiosztás, kampány és ajánló jutalom. Ezek nem számítanak eladásnak.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card label="Összes kiosztott ajándékjegy" value={stats?.giftTickets?.totalGiftTicketsIssued ?? 0} />
                    <Card label="Admin ajándékjegy" value={stats?.giftTickets?.adminGiftTickets ?? 0} />
                    <Card label="Kampány" value={stats?.giftTickets?.campaignClaims ?? 0} />
                    <Card label="Ajánló jutalom" value={stats?.giftTickets?.referralRewardTickets ?? 0} />
                </div>

                <h2 className="text-xl font-semibold mb-3">Bevétel</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card
                        label="Eladott csomagok (bruttó)"
                        value={`${revenue.gross ?? 0} Ft`}
                        hint="Befolyt jegycsomag-vásárlás"
                    />
                    <Card
                        label="Privát jegyek (bruttó)"
                        value={`${revenue.privateGross ?? 0} Ft`}
                        hint="Megvásárolt privát streamek"
                    />
                    <Card
                        label="Platform jutalék (eladásból)"
                        value={`${revenue.platformCommission ?? 0} Ft`}
                        hint={`${revenue.commissionPercent ?? 0}%`}
                    />
                    <Card
                        label="Tartalomkészítőnek jóváírva"
                        value={`${revenue.streamerNet ?? 0} Ft`}
                        hint="Csak felhasznált jegy után"
                    />
                    <Card label="Befolyt fizetés" value={`${revenue.paymentsSum ?? 0} Ft`} />
                </div>
                <p className="mb-8 text-sm">
                    <a href="/admin/costs" className="text-yellow-300 underline">
                        Üzemeltetési költségek (tárhely, CDN, transzkód, szerver, DB, e-mail)
                    </a>
                </p>

                <h2 className="text-xl font-semibold mb-3">Élő nézőszám</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <Card label="Most nézi" value={live.now ?? 0} hint="Aktív HLS session, ~90 mp" />
                    <Card label="Élő műsorok" value={live.byShow?.length ?? 0} hint="Csak a bekapcsolt élő adás" />
                    <Card
                        label="Peak nézők"
                        value={live.peakViewers ?? stats?.peakViewers ?? 0}
                        hint="Legmagasabb mintavétel + mostani élő"
                    />
                    <Card
                        label="Átlagos nézési idő"
                        value={formatWatchDuration(stats?.averageWatchSeconds)}
                        hint="Élő session + archív megtekintés"
                    />
                </div>
                <ul className="mb-8 space-y-2 text-sm">
                    {(live.byShow || []).length === 0 && (
                        <li className="text-gray-400">Most senki nem néz élő adást.</li>
                    )}
                    {(live.byShow || []).map((row: any) => (
                        <li key={row.showId} className="bg-gray-800 p-3 rounded flex justify-between">
                            <span>
                                {row.title}
                                {row.streamer ? ` · ${row.streamer}` : ""}
                            </span>
                            <span className="text-green-400 font-semibold">
                                {row.viewers} néző
                                {row.peakViewers ? ` · peak ${row.peakViewers}` : ""}
                            </span>
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-3">Archívum megtekintések</h2>
                <div className="mb-4">
                    <Card label="Összes megtekintés" value={archives.total ?? 0} />
                </div>
                <ul className="mb-8 space-y-2 text-sm">
                    {(archives.byShow || []).length === 0 && (
                        <li className="text-gray-400">Még nincs archív megtekintés.</li>
                    )}
                    {(archives.byShow || []).map((row: any) => (
                        <li key={row.showId} className="bg-gray-800 p-3 rounded flex justify-between">
                            <span>
                                {row.title}
                                {row.streamer ? ` · ${row.streamer}` : ""}
                            </span>
                            <span>{row.views} megtekintés</span>
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-3">Stream indulási hibák</h2>
                <p className="text-gray-500 text-sm mb-3">
                    FFmpeg / ingest hibák, amik eddig csak a szerver naplóban jelentek meg.
                </p>
                <ul className="mb-8 space-y-2 text-sm">
                    {(stats?.streamErrors || []).length === 0 && (
                        <li className="text-gray-400">Nincs rögzített indulási hiba.</li>
                    )}
                    {(stats?.streamErrors || []).map((row: any) => (
                        <li key={row.id} className="bg-gray-800 p-3 rounded">
                            <p className="font-semibold">
                                {row.showTitle || row.streamId || "Ismeretlen stream"}
                            </p>
                            <p className="text-red-300">{row.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {row.source || "ingest"}
                                {row.createdAt
                                    ? ` · ${formatDateTime(row.createdAt)}`
                                    : ""}
                            </p>
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-3">Tartalomkészítő teljesítmény</h2>
                <div className="overflow-x-auto mb-8">
                    <table className="w-full text-sm">
                        <thead className="text-gray-400 text-left">
                            <tr>
                                <th className="p-2">Tartalomkészítő</th>
                                <th className="p-2">Jegy</th>
                                <th className="p-2">Privát jegy</th>
                                <th className="p-2">Bruttó</th>
                                <th className="p-2">Nettó</th>
                                <th className="p-2">Élő</th>
                                <th className="p-2">Peak</th>
                                <th className="p-2">Átlagos nézés</th>
                                <th className="p-2">Archív</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(stats?.streamerPerformance || []).map((s: any) => (
                                <tr key={s.id} className="border-t border-gray-800">
                                    <td className="p-2 font-semibold">{s.name}</td>
                                    <td className="p-2">{s.tickets}</td>
                                    <td className="p-2">{s.privateTickets ?? 0}</td>
                                    <td className="p-2">{s.gross} Ft</td>
                                    <td className="p-2">{s.net} Ft</td>
                                    <td className="p-2">{s.liveViewers}</td>
                                    <td className="p-2">{s.peakViewers ?? 0}</td>
                                    <td className="p-2">{formatWatchDuration(s.averageWatchSeconds)}</td>
                                    <td className="p-2">{s.archiveViews}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {(stats?.streamerPerformance || []).length === 0 && (
                        <p className="text-gray-400 mt-3">Nincs tartalomkészítő adat.</p>
                    )}
                </div>

                <h2 className="text-xl font-semibold mb-3">Műsorok — felhasznált jegyek</h2>
                <p className="text-gray-500 text-sm mb-3">
                    Itt a kérdés / értékelés után levont jegyek jelennek meg, nem a csomagvásárlás.
                </p>
                <ul className="space-y-2 text-sm">
                    {(stats?.topShows || []).length === 0 && (
                        <li className="text-gray-400">Még nincs felhasznált jegy műsoron.</li>
                    )}
                    {(stats?.topShows || []).map((s: any, i: number) => (
                        <li key={s.id} className="bg-gray-800 p-3 rounded flex justify-between gap-3">
                            <span>
                                {i + 1}. {s.title}
                                {s.streamer ? ` · ${s.streamer}` : ""}
                            </span>
                            <span>
                                {s.tickets} jegy · {s.gross} Ft
                            </span>
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

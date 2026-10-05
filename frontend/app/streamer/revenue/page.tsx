"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerRevenuePage() {
    const gate = useStreamerGate();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/revenue")
            .then(setData)
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a bevételeket."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Bevételek">
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <p className="text-neutral-400 mb-2">
                Tartalomkészítő részesedés: {data?.streamerPercent ?? 80}% · platform: {data?.commissionPercent ?? 20}%.
                A bevétel a műsoron felhasznált jegyek értékéből számolódik automatikusan.
                Privát jegy összege csak a műsor leadása után jelenik meg (élő adás befejezése vagy archívum).
            </p>
            {data?.payoutDue?.label && (
                <p className="mb-6 text-sm text-yellow-300">{data.payoutDue.label}</p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Felhasznált fizetett jegyek</p>
                    <p className="text-2xl font-bold">{data?.ticketsSpent ?? data?.ticketsSold ?? 0}</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Felhasznált ajándékjegy</p>
                    <p className="text-2xl font-bold">{data?.giftTicketsSpent ?? 0}</p>
                    <p className="text-xs text-neutral-500 mt-1">Nem számít bele a kifizetésbe</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Bruttó bevétel</p>
                    <p className="text-2xl font-bold">{data?.gross ?? 0} Ft</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Platform levonás</p>
                    <p className="text-2xl font-bold">{data?.commission ?? 0} Ft</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Kifizetendő (elérhető)</p>
                    <p className="text-2xl font-bold">{data?.available ?? 0} Ft</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Nettó bevétel</p>
                    <p className="text-2xl font-bold">{data?.net ?? 0} Ft</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Archív megtekintés</p>
                    <p className="text-2xl font-bold">{data?.archiveViews ?? 0}</p>
                    <p className="text-xs text-neutral-500 mt-1">Tájékoztató, nem számít bele a kifizetésbe</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Értékelés átlag</p>
                    <p className="text-2xl font-bold">{data?.reviewAverage ?? 0} / 5</p>
                    <p className="text-xs text-neutral-500 mt-1">{data?.reviewCount ?? 0} értékelés</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Kifizetve</p>
                    <p className="text-2xl font-bold">{data?.paidOut ?? 0} Ft</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl">
                    <p className="text-neutral-400 text-sm">Függő privát jegy</p>
                    <p className="text-2xl font-bold">{data?.privateHeldNet ?? 0} Ft</p>
                    <p className="text-xs text-neutral-500 mt-1">
                        {data?.privateHeldTickets ?? 0} jegy · a műsor leadása után jár
                    </p>
                </div>
            </div>
            {(data?.ticketGroups || []).length > 0 && (
                <div className="bg-neutral-900 p-4 rounded-xl mb-8">
                    <p className="font-semibold mb-3">Jegycsoportonként</p>
                    <ul className="grid sm:grid-cols-2 gap-3 text-sm">
                        {data.ticketGroups.map((g: any) => (
                            <li key={g.key || g.name}>
                                <span className="font-semibold">{g.name}:</span> {g.ticketsSpent} db ·{" "}
                                {g.creditedAmount} Ft
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <ul className="space-y-3">
                {data?.shows?.map((s: any) => (
                    <li key={s.id} className="bg-neutral-900 p-4 rounded-xl flex justify-between gap-4">
                        <div>
                            <p className="font-semibold">{s.title}</p>
                            <p className="text-sm text-neutral-400">
                                {s.tickets} fizetett jegy
                                {s.giftTickets ? ` · ${s.giftTickets} ajándékjegy` : ""} · bruttó {s.gross} Ft · platform {s.platformPercent}% ({s.commission} Ft)
                            </p>
                            {s.privatePending && (
                                <p className="mt-1 text-sm text-yellow-300">
                                    Privát jegy: {s.heldNet} Ft a műsor leadása után jár ({s.heldTickets} jegy).
                                </p>
                            )}
                        </div>
                        <p className="font-bold whitespace-nowrap">nettó {s.net} Ft</p>
                    </li>
                ))}
            </ul>
        </StreamerShell>
    );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { useT } from "@/lib/i18n/I18nProvider";

export default function StreamerPrivateRequestsPage() {
    const { formatDateTime } = useT();
    const gate = useStreamerGate();
    const [rows, setRows] = useState<any[]>([]);
    const [band, setBand] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/private-requests")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "Nem tölthető be."));
        apiFetch("/streamer/private-requests/band")
            .then(setBand)
            .catch(() => undefined);
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Jóváhagyott tartalomkészítő fiók kell.</p>;

    return (
        <StreamerShell title="Privát kívánságok">
            <p className="mb-6 max-w-2xl text-sm text-zinc-400">
                Itt a nézők privát műsorajánlataira jelentkezhetsz. Az árat csak a saját
                értékelési sávodban adhatod meg.
            </p>
            {band && (
                <p className="mb-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
                    Kategóriád: {band.stars}★ · {band.average || 0}/5 ({band.count} értékelés) ·
                    ársáv {band.minPrice}–{band.maxPrice} Ft
                </p>
            )}
            {error && <p className="mb-4 text-red-400">{error}</p>}
            {!rows.length && <p className="text-zinc-400">Most nincs nyitott privát kívánság.</p>}
            <ul className="space-y-3">
                {rows.map((row) => (
                    <li key={row.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
                        <p className="text-sm text-yellow-400">{row.authorName}</p>
                        <p className="mt-1 font-semibold">{row.topic}</p>
                        <p className="mt-1 text-zinc-300">{row.details}</p>
                        <p className="mt-2 text-xs text-zinc-500">
                            Határidő: {formatDateTime(row.deadlineAt)}
                        </p>
                        <Link
                            href={`/streamer/private-requests/${row.id}`}
                            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent"
                        >
                            Jelentkezés
                        </Link>
                    </li>
                ))}
            </ul>
        </StreamerShell>
    );
}

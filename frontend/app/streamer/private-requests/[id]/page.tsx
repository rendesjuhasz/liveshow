"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { Button } from "@/components/ui/button";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";

export default function StreamerPrivateApplyPage() {
    const { id } = useParams<{ id: string }>();
    const gate = useStreamerGate();
    const [row, setRow] = useState<any>(null);
    const [band, setBand] = useState<any>(null);
    const [plan, setPlan] = useState("");
    const [price, setPrice] = useState("");
    const [slots, setSlots] = useState(["", ""]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!gate.ok || !id) return;
        apiFetch(`/streamer/private-requests/${id}`)
            .then((d) => {
                setRow(d);
                const mine = (d.offers || [])[0];
                if (mine) {
                    setPlan(mine.plan || "");
                    setPrice(String(mine.price || ""));
                    setSlots((mine.proposedStarts || []).map((s: string) => s.slice(0, 16)).concat(["", ""]).slice(0, 3));
                }
            })
            .catch((err: any) => setError(err.message || "Nem tölthető be."));
        apiFetch("/streamer/private-requests/band").then(setBand).catch(() => undefined);
    }, [gate.ok, id]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        const leak = contactLeakWarning(plan);
        if (leak) {
            setError(leak);
            return;
        }
        setBusy(true);
        try {
            await apiFetch(`/streamer/private-requests/${id}/apply`, {
                method: "POST",
                body: JSON.stringify({
                    plan,
                    price: Number(price),
                    proposedStarts: slots.filter(Boolean).map((s) => new Date(s).toISOString()),
                }),
            });
            const next = await apiFetch(`/streamer/private-requests/${id}`);
            setRow(next);
        } catch (err: any) {
            setError(err.message || "A jelentkezés sikertelen.");
        } finally {
            setBusy(false);
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Jóváhagyott streamer fiók kell.</p>;

    return (
        <StreamerShell title="Privát ajánlat">
            {row && (
                <div className="mb-6">
                    <p className="font-semibold">{row.topic}</p>
                    <p className="mt-2 text-zinc-300">{row.details}</p>
                    <p className="mt-2 text-sm text-zinc-500">Határidő: {row.deadlineLabel}</p>
                </div>
            )}
            {band && (
                <p className="mb-4 text-sm text-accent">
                    Ársávod: {band.minPrice}–{band.maxPrice} Ft ({band.stars}★)
                </p>
            )}
            <form onSubmit={submit} className="max-w-xl grid gap-4 rounded-2xl bg-neutral-900 p-5">
                <label className="grid gap-2 text-sm">
                    Hogyan valósítanád meg a műsort?
                    <textarea
                        className="min-h-28 rounded-xl border border-white/10 bg-black p-3 text-base"
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        required
                        minLength={8}
                    />
                </label>
                <ContactLeakHint warning={contactLeakWarning(plan)} />
                <label className="grid gap-2 text-sm">
                    Ajánlott ár (Ft)
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3 text-base"
                        type="number"
                        min={band?.minPrice || 0}
                        max={band?.maxPrice || undefined}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                    />
                </label>
                {slots.map((slot, idx) => (
                    <label key={idx} className="grid gap-2 text-sm">
                        Lehetséges kezdés {idx + 1}
                        <input
                            className="h-11 rounded-xl border border-white/10 bg-black px-3 text-base"
                            type="datetime-local"
                            value={slot}
                            onChange={(e) =>
                                setSlots((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                            }
                            required={idx === 0}
                        />
                    </label>
                ))}
                {error && <p className="text-red-400">{error}</p>}
                <Button type="submit" variant="gold" disabled={busy}>
                    {busy ? "Küldés..." : "Ajánlat elküldése"}
                </Button>
            </form>
        </StreamerShell>
    );
}

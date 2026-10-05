"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { WishStatusLine, type WishItem } from "@/components/WishWall";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { Button } from "@/components/ui/button";

export default function StreamerWishesPage() {
    const gate = useStreamerGate();
    const [items, setItems] = useState<WishItem[]>([]);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState("");
    const [myStreamerId, setMyStreamerId] = useState("");

    async function load() {
        const data = await apiFetch("/streamer/wishes");
        setItems(Array.isArray(data) ? data : []);
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err: any) => setError(err.message || "Nem sikerült betölteni a kívánságokat."));
        apiFetch("/streamers/me")
            .then((d) => setMyStreamerId(d?.streamer?.id || ""))
            .catch(() => undefined);
    }, [gate.ok]);

    async function act(id: string, action: "accept" | "reject" | "complete") {
        setError("");
        setBusyId(id + action);
        try {
            await apiFetch(`/streamer/wishes/${id}/${action}`, { method: "POST" });
            await load();
        } catch (err: any) {
            setError(err.message || "A művelet sikertelen.");
        } finally {
            setBusyId("");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) {
        return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;
    }

    return (
        <StreamerShell title="Kívánságfal">
            <p className="mb-6 max-w-2xl text-sm text-zinc-400">
                Elfogadás = vállalod a jövőben. Nem lesz automatikusan teljesített. Teljesítve csak
                akkor, ha tényleg megcsináltad — ekkor a beküldő XP-t és Ötletgazda jelvényt kap.
                A privát kívánságok nem jelennek meg a nyilvános falon — azokra a{" "}
                <a href="/streamer/private-requests" className="text-accent underline">
                    Privát kívánságok
                </a>{" "}
                menüben jelentkezhetsz.
            </p>
            {error && <p className="mb-4 text-red-400">{error}</p>}
            {items.length === 0 && <p className="text-zinc-400">Még nincs beküldött kívánság.</p>}
            <ul className="space-y-3">
                {items.map((wish) => (
                    <li key={wish.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm text-yellow-400">{wish.authorName}</p>
                            {wish.visibility === "private" && (
                                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                                    Privát
                                </span>
                            )}
                        </div>
                        <p className="mt-1">{wish.text}</p>
                        <div className="mt-3">
                            <WishStatusLine wish={wish} />
                            <p className="mt-1 text-xs text-zinc-500">
                                Beküldve: {new Date(wish.createdAt).toLocaleDateString("hu-HU")}
                            </p>
                        </div>
                        {wish.status === "pending" && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="gold"
                                    size="sm"
                                    disabled={Boolean(busyId)}
                                    onClick={() => act(wish.id, "accept")}
                                >
                                    Elfogadás
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={Boolean(busyId)}
                                    onClick={() => act(wish.id, "reject")}
                                >
                                    Elutasítás
                                </Button>
                            </div>
                        )}
                        {wish.status === "accepted" && wish.streamer?.id === myStreamerId && (
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="mt-4"
                                disabled={Boolean(busyId)}
                                onClick={() => act(wish.id, "complete")}
                            >
                                Teljesítve
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
        </StreamerShell>
    );
}

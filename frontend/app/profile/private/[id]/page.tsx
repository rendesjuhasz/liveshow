"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/api/http";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function PrivateRequestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user, ready } = useAuth();
    const [row, setRow] = useState<any>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const [picked, setPicked] = useState<Record<string, string>>({});

    function load() {
        return apiFetch(`/private-requests/${id}`).then(setRow);
    }

    useEffect(() => {
        if (!ready || !user || !id) return;
        load().catch((err: any) => setError(err.message || "Nem tölthető be."));
    }, [ready, user, id]);

    function startAtFor(offer: any) {
        return picked[offer.id] || offer.proposedStarts?.[0] || "";
    }

    async function startPay(pay: any) {
        if (pay?.checkoutUrl) {
            window.location.href = pay.checkoutUrl;
            return true;
        }
        if (pay?.devPay && pay?.ticketId) {
            await apiFetch("/payments/confirm-dev", {
                method: "POST",
                body: JSON.stringify({ ticketId: pay.ticketId }),
            });
            await load();
            return true;
        }
        await load();
        return false;
    }

    async function choose(offerId: string, startAt: string) {
        setError("");
        setBusy(offerId);
        try {
            const pay = await apiFetch(`/private-requests/${id}/select`, {
                method: "POST",
                body: JSON.stringify({ offerId, startAt }),
            });
            const redirected = await startPay(pay);
            if (!redirected && !pay?.checkoutUrl) {
                setError("A jegy létrejött, de a fizetés nem indult. Nyomd meg a Jegy megvásárlása gombot.");
            }
        } catch (err: any) {
            setError(err.message || "A választás sikertelen.");
        } finally {
            setBusy("");
        }
    }

    async function checkout() {
        setError("");
        setBusy("pay");
        try {
            const pay = await apiFetch(`/private-requests/${id}/checkout`, { method: "POST" });
            const redirected = await startPay(pay);
            if (!redirected && !pay?.checkoutUrl) {
                setError("A fizetés nem indult el. Ellenőrizd a fizetési beállításokat, vagy próbáld újra.");
            }
        } catch (err: any) {
            setError(err.message || "A fizetés sikertelen.");
        } finally {
            setBusy("");
        }
    }

    if (!ready) return <p className="p-8 text-white">Betöltés...</p>;
    if (!user) {
        return (
            <p className="p-8 text-white">
                <Link href="/login" className="text-accent">
                    Jelentkezz be
                </Link>
            </p>
        );
    }
    if (!row) return <p className="p-8 text-white">{error || "Betöltés..."}</p>;

    const needsPay = row.status === "awarded" && row.ticketId;
    const selected = (row.offers || []).find((offer: any) => offer.id === row.selectedOfferId);

    return (
        <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
            <Link href="/profile?tab=private" className="text-sm text-accent hover:underline">
                ← Profil
            </Link>
            <h1 className="mt-4 text-2xl font-extrabold">{row.topic}</h1>
            <p className="mt-2 text-zinc-300">{row.details}</p>
            <p className="mt-2 text-sm text-zinc-500">
                {row.deadlineLabel} · {row.status}
            </p>
            <p className="mt-4 rounded-xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-400">
                {row.notice}
            </p>
            {error && <p className="mt-4 text-red-400">{error}</p>}

            {needsPay && (
                <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 p-4">
                    <p className="font-semibold">
                        Az időpont megvan. A privát streamhez vedd meg a jegyet
                        {selected ? ` (${selected.price} Ft)` : ""}.
                    </p>
                    <Button
                        type="button"
                        variant="gold"
                        className="mt-4"
                        disabled={Boolean(busy)}
                        onClick={checkout}
                    >
                        {busy === "pay" ? "Fizetés..." : "Jegy megvásárlása"}
                    </Button>
                </div>
            )}

            {row.status === "paid" && (
                <Link
                    href={`/private-stream/${row.id}`}
                    className="mt-6 inline-flex min-h-11 items-center text-accent"
                >
                    Belépés a privát streamre
                </Link>
            )}

            <h2 className="mt-8 mb-4 text-xl font-bold">Ajánlatok</h2>
            {!row.offers?.length && <p className="text-zinc-500">Még nincs jelentkező tartalomkészítő.</p>}
            <div className="space-y-4">
                {(row.offers || []).map((offer: any) => (
                    <article key={offer.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold">{offer.streamerName}</p>
                                <p className="text-sm text-accent">
                                    {offer.rating || 0} / 5 · {offer.reviewCount || 0} értékelés · {offer.starCategory}★
                                    sáv
                                </p>
                            </div>
                            <p className="text-lg font-black text-accent">{offer.price} Ft</p>
                        </div>
                        <p className="mt-3 text-zinc-200">{offer.plan}</p>
                        <label className="mt-4 grid gap-1 text-sm">
                            Javasolt időpont
                            <select
                                className="h-11 rounded-xl border border-white/10 bg-black px-3"
                                value={startAtFor(offer)}
                                onChange={(e) => setPicked((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                            >
                                {(offer.proposedStarts || []).map((slot: string) => (
                                    <option key={slot} value={slot}>
                                        {new Date(slot).toLocaleString("hu-HU")}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {row.status === "paid" && offer.status === "selected" ? (
                            <Link href={`/private-stream/${row.id}`} className="mt-4 inline-flex text-accent">
                                Belépés a privát streamre
                            </Link>
                        ) : row.status === "open" || (row.status === "awarded" && offer.id === row.selectedOfferId) ? (
                            <Button
                                type="button"
                                variant="gold"
                                className="mt-4"
                                disabled={Boolean(busy) || row.status === "paid"}
                                onClick={() =>
                                    row.status === "awarded" ? checkout() : choose(offer.id, startAtFor(offer))
                                }
                            >
                                {busy === offer.id || busy === "pay"
                                    ? "Fizetés..."
                                    : row.status === "awarded"
                                      ? "Jegy megvásárlása"
                                      : "Kiválasztom az időpontot és megveszem a jegyet"}
                            </Button>
                        ) : null}
                    </article>
                ))}
            </div>
        </div>
    );
}

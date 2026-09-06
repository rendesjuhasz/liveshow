"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";

const STATUS_LABEL: Record<string, string> = {
    pending: "Moderálásra vár",
    approved: "Jóváhagyva",
    rejected: "Elutasítva",
};

export default function ReviewForm({ showId }: { showId: string }) {
    const [data, setData] = useState<any>(null);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    async function load() {
        const next = await apiFetch(`/reviews/show/${showId}`);
        setData(next);
        if (next?.mine?.rating) setRating(next.mine.rating);
        if (next?.mine?.comment) setComment(next.mine.comment);
    }

    useEffect(() => {
        load().catch(() => setData({ reviews: [], average: 0, count: 0, canReview: false }));
    }, [showId]);

    return (
        <section className="mt-10 max-w-xl">
            <h2 className="text-xl font-bold mb-2">Értékelések</h2>
            <p className="text-neutral-400 mb-4">
                Átlag: {data?.average ?? 0} / 5 · {data?.count ?? 0} db
            </p>
            {data?.mine && (
                <p className="text-sm text-neutral-400 mb-3">
                    A te értékelésed: {data.mine.rating}/5 ·{" "}
                    {STATUS_LABEL[data.mine.status] || data.mine.status}
                    {data.mine.status === "pending" &&
                        " — a nyilvános listán a jóváhagyás után jelenik meg."}
                </p>
            )}
            {data?.canReview && (
                <form
                    className="grid gap-3 mb-6"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setNote("");
                        const leak = contactLeakWarning(comment);
                        if (leak) {
                            setNote(leak);
                            return;
                        }
                        setSaving(true);
                        try {
                            await apiFetch("/reviews", {
                                method: "POST",
                                body: JSON.stringify({ showId, rating, comment }),
                            });
                            await load();
                            setNote("Az értékelés elküldve, moderálásra vár.");
                        } catch (err: any) {
                            setNote(err.message || "Nem sikerült értékelni.");
                        } finally {
                            setSaving(false);
                        }
                    }}
                >
                    <div className="flex gap-1" role="group" aria-label="Csillagok">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setRating(n)}
                                className={`text-2xl leading-none ${
                                    n <= rating ? "text-yellow-400" : "text-neutral-600"
                                }`}
                                aria-label={`${n} csillag`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="rounded-xl border border-white/10 bg-black p-3"
                        placeholder="Szöveges értékelés (opcionális)"
                        maxLength={1000}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                    <ContactLeakHint warning={contactLeakWarning(comment)} />
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-yellow-500 text-black font-bold p-2 rounded disabled:opacity-60"
                    >
                        {saving ? "Küldés..." : "Értékelés küldése"}
                    </button>
                    {note && <p className="text-sm">{note}</p>}
                </form>
            )}
            {!data?.canReview && !data?.mine && (
                <p className="text-sm text-neutral-500 mb-4">
                    {!data
                        ? "Betöltés..."
                        : data.needsTicket
                          ? "Értékeléshez 1 felhasználható jegy kell a jegycsomagból. Az első küldéskor levonódik."
                          : data.ended === false
                            ? "Értékelni akkor lehet, ha az adás már leállt."
                            : "Értékeléshez jelentkezz be nézőként, és legyen felhasználható jegyed."}
                </p>
            )}
            <ul className="space-y-2">
                {data?.reviews?.map((r: any) => (
                    <li key={r.id} className="bg-neutral-900 p-3 rounded">
                        <span className="text-yellow-400">{"★".repeat(r.rating)}</span>
                        <span className="text-neutral-600">{"★".repeat(Math.max(0, 5 - r.rating))}</span>
                        {r.comment ? <p className="mt-1">{r.comment}</p> : null}
                    </li>
                ))}
            </ul>
        </section>
    );
}

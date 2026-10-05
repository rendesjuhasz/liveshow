"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STREAMER_FAQ, type StreamerFaqItem } from "@/lib/streamer-faq";

function matches(item: StreamerFaqItem, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [item.category, item.question, item.answer].some((part) => part.toLowerCase().includes(q));
}

export default function StreamerFaqList() {
    const [query, setQuery] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);

    const grouped = useMemo(() => {
        const filtered = STREAMER_FAQ.filter((item) => matches(item, query));
        const map = new Map<string, StreamerFaqItem[]>();
        for (const item of filtered) {
            if (!map.has(item.category)) map.set(item.category, []);
            map.get(item.category)!.push(item);
        }
        const order: string[] = [];
        for (const item of STREAMER_FAQ) {
            if (!order.includes(item.category)) order.push(item.category);
        }
        return order
            .filter((cat) => map.has(cat))
            .map((category) => ({ category, items: map.get(category)! }));
    }, [query]);

    return (
        <div>
            <input
                className="mb-8 w-full rounded-xl p-3 text-black"
                placeholder="Keresés a tartalomkészítő súgóban…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {grouped.length === 0 && <p className="mb-8 text-neutral-400">Nincs találat.</p>}
            <div className="space-y-10">
                {grouped.map((group) => (
                    <section key={group.category}>
                        <h2 className="mb-4 text-xl font-semibold text-yellow-400">{group.category}</h2>
                        <div className="space-y-2">
                            {group.items.map((item) => {
                                const open = openId === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
                                    >
                                        <button
                                            type="button"
                                            className="w-full px-4 py-3 text-left font-medium hover:bg-neutral-800"
                                            onClick={() => setOpenId(open ? null : item.id)}
                                            aria-expanded={open}
                                        >
                                            {item.question}
                                        </button>
                                        {open && (
                                            <div className="whitespace-pre-wrap px-4 pb-4 text-neutral-300">
                                                {item.answer}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
            <div className="mt-12 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center">
                <p className="mb-1 text-lg font-semibold">Nem találod a megoldást?</p>
                <p className="mb-4 text-neutral-400">Olvasd a kézikönyvet, vagy küldj hibabejelentést.</p>
                <div className="flex flex-wrap justify-center gap-3">
                    <Link
                        href="/streamer/help/guide"
                        className="inline-block rounded-xl bg-neutral-800 px-6 py-3 font-bold text-white"
                    >
                        Platform útmutató
                    </Link>
                    <Link
                        href="/streamer/help/contact"
                        className="inline-block rounded-xl bg-yellow-500 px-6 py-3 font-bold text-black"
                    >
                        Hibabejelentés küldése
                    </Link>
                </div>
            </div>
        </div>
    );
}

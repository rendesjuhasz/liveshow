"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type FaqItem = {
    id: string;
    category: string;
    question: string;
    answer: string;
    order?: number;
};

const CATEGORY_ORDER = ["Jegyvásárlás", "Közvetítések", "Fiókom", "Fizetés", "Archívum"];

function matches(item: FaqItem, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [item.category, item.question, item.answer].some((part) =>
        String(part || "").toLowerCase().includes(q),
    );
}

export default function FaqList({
    items,
    showSearch = true,
    showContact = true,
    limit,
}: {
    items: FaqItem[];
    showSearch?: boolean;
    showContact?: boolean;
    limit?: number;
}) {
    const [query, setQuery] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const list = items.filter((item) => matches(item, query));
        return typeof limit === "number" ? list.slice(0, limit) : list;
    }, [items, query, limit]);

    const grouped = useMemo(() => {
        const map = new Map<string, FaqItem[]>();
        for (const item of filtered) {
            const key = item.category || "Egyéb";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        }
        const keys = [...map.keys()].sort((a, b) => {
            const ai = CATEGORY_ORDER.indexOf(a);
            const bi = CATEGORY_ORDER.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b, "hu");
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });
        return keys.map((category) => ({ category, items: map.get(category)! }));
    }, [filtered]);

    return (
        <div>
            {showSearch && (
                <input
                    className="w-full mb-8 p-3 rounded-xl text-black"
                    placeholder="Keresés a kérdések között..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            )}

            {grouped.length === 0 && (
                <p className="text-neutral-400 mb-8">Nincs találat a keresésre.</p>
            )}

            <div className="space-y-10">
                {grouped.map((group) => (
                    <section key={group.category}>
                        <h2 className="text-xl font-semibold mb-4 text-yellow-400">{group.category}</h2>
                        <div className="space-y-2">
                            {group.items.map((item) => {
                                const open = openId === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden"
                                    >
                                        <button
                                            type="button"
                                            className="w-full text-left px-4 py-3 font-medium hover:bg-neutral-800"
                                            onClick={() => setOpenId(open ? null : item.id)}
                                            aria-expanded={open}
                                        >
                                            {item.question}
                                        </button>
                                        {open && (
                                            <div className="px-4 pb-4 text-neutral-300 whitespace-pre-wrap">
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

            {showContact && (
                <div className="mt-12 p-6 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
                    <p className="text-lg font-semibold mb-1">Nem találtad a választ?</p>
                    <p className="text-neutral-400 mb-4">Lépj kapcsolatba velünk.</p>
                    <Link
                        href="/kapcsolat"
                        className="inline-block bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl"
                    >
                        Kapcsolat
                    </Link>
                </div>
            )}
        </div>
    );
}

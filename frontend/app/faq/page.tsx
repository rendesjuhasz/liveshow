"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import FaqList, { type FaqItem } from "@/components/FaqList";

export default function FaqPage() {
    const [items, setItems] = useState<FaqItem[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/faq")
            .then((data) => setItems(Array.isArray(data) ? data : []))
            .catch((err) => setError(err.message || "A FAQ betöltése sikertelen."))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-dvh bg-background px-4 py-10 text-white sm:py-16">
            <div className="max-w-3xl mx-auto">
                <h1 className="mb-3 text-3xl font-bold md:text-4xl">Gyakori kérdések</h1>
                <p className="text-neutral-400 mb-8">
                    A leggyakoribb problémákra itt azonnal választ kaphatsz ügyfélszolgálat nélkül.
                </p>
                {loading && <p>Betöltés...</p>}
                {error && <p className="text-red-400">{error}</p>}
                {!loading && !error && <FaqList items={items} />}
            </div>
        </div>
    );
}

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiUpload } from "@/api/http";
import { STREAMER_HELP_TOPICS } from "@/lib/streamer-faq";

const TOPIC_IDS = new Set<string>(STREAMER_HELP_TOPICS.map((t) => t.id));

export default function StreamerReportForm() {
    const search = useSearchParams();
    const initialTopic = useMemo(() => {
        const q = String(search.get("topic") || "");
        return TOPIC_IDS.has(q) ? q : "live";
    }, [search]);
    const [topic, setTopic] = useState(initialTopic);
    const [description, setDescription] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [ok, setOk] = useState("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setOk("");
        if (description.trim().length < 10) {
            setError("A leírás legalább 10 karakter legyen.");
            return;
        }
        setBusy(true);
        try {
            const form = new FormData();
            form.set("topic", topic);
            form.set("description", description.trim());
            if (file) form.set("screenshot", file);
            const res = await apiUpload("/streamer/help/report", form);
            setOk(res?.message || "Megkaptuk a bejelentést.");
            setDescription("");
            setFile(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "A küldés nem sikerült.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="max-w-xl space-y-4 rounded-2xl bg-neutral-900 p-4" onSubmit={(e) => void onSubmit(e)}>
            <label className="grid gap-1 text-sm">
                Probléma típusa
                <select
                    className="rounded-xl bg-neutral-800 p-3 text-white"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                >
                    {STREAMER_HELP_TOPICS.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="grid gap-1 text-sm">
                Leírás
                <textarea
                    className="min-h-32 rounded-xl bg-neutral-800 p-3 text-white"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={4000}
                    required
                    placeholder="Mi történt, melyik műsor, milyen eszköz?"
                />
            </label>
            <label className="grid gap-1 text-sm">
                Képernyőkép (opcionális, JPEG/PNG/WebP, max. 5 MB)
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-sm"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
            </label>
            {error && <p className="text-red-400">{error}</p>}
            {ok && <p className="text-emerald-400">{ok}</p>}
            <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black disabled:opacity-50"
            >
                {busy ? "Küldés..." : "Küldés"}
            </button>
        </form>
    );
}

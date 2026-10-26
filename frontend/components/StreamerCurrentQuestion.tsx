"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/api/http";
import ReportButton from "@/components/ReportButton";

export default function StreamerCurrentQuestion({
    shows,
    showId,
    onShowIdChange,
}: {
    shows: { id: string; title: string; live?: boolean }[];
    showId: string;
    onShowIdChange?: (id: string) => void;
}) {
    const [data, setData] = useState<any>(null);
    const [support, setSupport] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [ttsOn, setTtsOn] = useState(false);
    const spokenKey = useRef("");

    async function load(id = showId) {
        const qs = id ? `?showId=${encodeURIComponent(id)}` : "";
        const [q, s] = await Promise.all([
            apiFetch(`/streamer/questions${qs}`),
            apiFetch(`/streamer/support${qs}`).catch(() => []),
        ]);
        setData(q);
        setSupport(Array.isArray(s) ? s : []);
    }

    useEffect(() => {
        if (!showId) return;
        load().catch((err: any) => setError(err.message || "Nem sikerült betölteni a kérdést."));
        const t = setInterval(() => load().catch(() => undefined), 8000);
        return () => clearInterval(t);
    }, [showId]);

    useEffect(() => {
        const current = data?.current;
        if (!ttsOn || !current?.text) return;
        if (spokenKey.current === current.topicKey) return;
        spokenKey.current = current.topicKey;
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(current.text);
        u.lang = "hu-HU";
        window.speechSynthesis.speak(u);
    }, [data?.current?.topicKey, data?.current?.text, ttsOn]);

    async function act(path: "/streamer/questions/next" | "/streamer/questions/reject") {
        setError("");
        setBusy(true);
        try {
            const res = await apiFetch(path, {
                method: "POST",
                body: JSON.stringify({ showId }),
            });
            setData((prev: any) => ({ ...prev, current: res?.next ?? null }));
            spokenKey.current = "";
            await load();
        } catch (err: any) {
            setError(err.message || "A művelet nem sikerült.");
        } finally {
            setBusy(false);
        }
    }

    const current = data?.current;

    return (
        <div className="grid gap-6">
            {error && <p className="text-red-400">{error}</p>}
            <p className="max-w-2xl text-sm text-neutral-400">
                Nincs kérdéslista. Egyszerre csak az aktuálisan legfontosabb kérdés jelenik meg. Jegy
                csak a „Következő kérdés” gombra vonódik le.
            </p>
            {onShowIdChange && (
                <label className="grid max-w-md gap-1">
                    Műsor
                    <select
                        className="rounded p-3 text-black"
                        value={showId}
                        onChange={(e) => onShowIdChange(e.target.value)}
                    >
                        {shows.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.title}
                                {s.live ? " · élő" : ""}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={ttsOn}
                    onChange={(e) => {
                        setTtsOn(e.target.checked);
                        if (!e.target.checked && typeof window !== "undefined") {
                            window.speechSynthesis?.cancel();
                        }
                    }}
                />
                Kérdés felolvasása (fülhallgató / böngésző TTS)
            </label>
            <div className="max-w-2xl rounded-2xl border border-white/10 bg-neutral-900 p-6">
                {current ? (
                    <>
                        <p className="text-xs uppercase tracking-wide text-accent">Aktuális kérdés</p>
                        <p className="mt-3 text-2xl font-semibold leading-snug">{current.text}</p>
                        <p className="mt-4 text-neutral-400">
                            {current.supportCount} néző kérdezte ugyanezt vagy hasonlót
                            {current.questionCount > current.supportCount
                                ? ` · ${current.questionCount} beküldés`
                                : ""}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => act("/streamer/questions/next")}
                                className="rounded-xl bg-emerald-600 px-5 py-3 font-bold disabled:opacity-50"
                            >
                                Megválaszoltam, következő
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => act("/streamer/questions/reject")}
                                className="rounded-xl bg-red-700 px-5 py-3 font-bold disabled:opacity-50"
                            >
                                Elutasítás
                            </button>
                        </div>
                        <p className="mt-3 text-xs text-neutral-500">
                            A zöld gomb: a kérdés teljesült, jegy levonódik, jön a következő. Elutasítás: nincs jegylevonás.
                        </p>
                        {current.ids?.[0] && (
                            <div className="mt-3">
                                <ReportButton targetType="question" targetId={current.ids[0]} />
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-neutral-400">Jelenleg nincs függőben lévő kérdés.</p>
                )}
            </div>
            <details className="max-w-2xl">
                <summary className="cursor-pointer text-sm text-neutral-500">
                    Visszajelzések (nem a kérdésfolyam)
                </summary>
                <ul className="mt-3 space-y-2 text-sm">
                    {support.length === 0 && <li className="text-neutral-500">Nincs visszajelzés.</li>}
                    {support.map((row) => (
                        <li key={row.id} className="rounded-lg bg-neutral-900/80 p-3">
                            <span className="text-xs uppercase text-neutral-500">
                                {row.kind === "support"
                                    ? `Támogatás (${Number(row.ticketsSpent) || 1} jegy)`
                                    : row.kind === "thanks"
                                      ? "Köszönet"
                                      : row.kind === "feedback"
                                        ? "Visszajelzés"
                                        : row.kind === "opinion"
                                          ? "Vélemény"
                                          : row.kind}
                            </span>
                            <p className="mt-1">{row.text || "—"}</p>
                            <p className="mt-1 text-xs text-neutral-500">{row.author}</p>
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );
}

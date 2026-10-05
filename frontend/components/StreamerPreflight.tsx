"use client";

import { useEffect, useState } from "react";
import {
    fetchPreflightLast,
    runPreflight,
    type CheckState,
    type PreflightLast,
    type PreflightRunResult,
} from "@/lib/preflight";
import {
    clockClass,
    formatPreflightAge,
    gradeLabel,
    gradeToLinkQuality,
    type PreflightGrade,
} from "@/lib/live-link-quality";

function mark(state: CheckState) {
    if (state === "pending") return "⏳";
    if (state === "ok") return "✅";
    if (state === "fail") return "❌";
    return "·";
}

function Row({
    label,
    state,
    detail,
}: {
    label: string;
    state: CheckState;
    detail: string;
}) {
    return (
        <div className="rounded-xl bg-neutral-900 px-4 py-3">
            <p className="flex items-center justify-between gap-3 text-base font-semibold">
                <span>
                    {mark(state)} {label}
                </span>
            </p>
            {detail ? <p className="mt-1 text-sm text-neutral-400">{detail}</p> : null}
        </div>
    );
}

export default function StreamerPreflight({
    onLiveReady,
}: {
    onLiveReady?: (grade: PreflightGrade) => void;
}) {
    const [last, setLast] = useState<PreflightLast | null>(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<Partial<PreflightRunResult> | null>(null);

    useEffect(() => {
        fetchPreflightLast()
            .then(setLast)
            .catch(() => undefined);
    }, []);

    async function start() {
        if (running) return;
        setError("");
        setRunning(true);
        setResult({
            camera: "pending",
            mic: "pending",
            network: "pending",
            ingest: "pending",
            cameraDetail: "Ellenőrzés...",
            micDetail: "Ellenőrzés...",
            networkDetail: "Ellenőrzés...",
            ingestDetail: "Ellenőrzés...",
        });
        try {
            const done = await runPreflight((partial) => {
                setResult((prev) => ({ ...prev, ...partial }));
            });
            setResult(done);
            const next = await fetchPreflightLast().catch(() => null);
            if (next) setLast(next);
            if (done.liveOk) onLiveReady?.(done.grade);
        } catch (err) {
            setError(err instanceof Error ? err.message : "A teszt nem futott le.");
        } finally {
            setRunning(false);
        }
    }

    const grade = result?.grade;
    const quality = grade ? gradeToLinkQuality(grade) : null;
    const label = grade ? gradeLabel(grade) : null;

    return (
        <section className="rounded-2xl border border-white/10 bg-neutral-950 p-4 sm:p-5">
            <h2 className="text-xl font-bold">Adás előtti ellenőrzés</h2>
            <p className="mt-1 text-sm text-neutral-400">
                5–10 másodperc: kamera, mikrofon, hálózat és stream szerver. Engedélyezd a
                kamerát és a mikrofont, ha a telefon kéri.
            </p>
            {last?.lastPreflightAt ? (
                <p className={`mt-3 text-sm ${last.stale ? "text-yellow-300" : "text-neutral-300"}`}>
                    {formatPreflightAge(last.ageMs)}
                    {last.stale
                        ? " ⚠️ A hálózati állapot azóta megváltozhatott. Új teszt ajánlott."
                        : ""}
                </p>
            ) : (
                <p className="mt-3 text-sm text-neutral-500">Még nem volt sikeres teszt ezen a fiókon.</p>
            )}

            <button
                type="button"
                onClick={() => void start()}
                disabled={running}
                className="mt-4 min-h-12 w-full rounded-2xl bg-sky-600 text-base font-bold disabled:opacity-50"
            >
                {running ? "Teszt fut..." : "🔍 Teszt indítása"}
            </button>

            {error ? (
                <p className="mt-3 rounded-xl bg-red-950/70 p-3 text-sm text-red-300" role="alert">
                    {error}
                </p>
            ) : null}

            {result ? (
                <div className="mt-4 grid gap-2">
                    <Row label="Kamera" state={result.camera || "idle"} detail={result.cameraDetail || ""} />
                    <Row label="Mikrofon" state={result.mic || "idle"} detail={result.micDetail || ""} />
                    <Row label="Hálózat" state={result.network || "idle"} detail={result.networkDetail || ""} />
                    <Row
                        label="Stream szerver"
                        state={result.ingest || "idle"}
                        detail={result.ingestDetail || ""}
                    />
                </div>
            ) : null}

            {grade && label && quality && !running ? (
                <div className="mt-4 rounded-xl bg-black/40 p-4">
                    <p className={`text-lg font-bold ${clockClass(quality)}`}>
                        Kapcsolat minősége: {label.emoji} {label.text}
                    </p>
                    <p className="mt-2 text-sm text-neutral-300">
                        Upload: {result?.uploadMbps ?? "–"} Mbps · Ping: {result?.pingMs ?? "–"} ms ·
                        Jitter: {result?.jitterMs ?? "–"} ms
                    </p>
                    <p className="mt-1 text-sm text-neutral-300">
                        Ajánlott minőség: {result?.recommended?.label}
                    </p>
                    {result?.warning ? (
                        <p className={`mt-2 text-sm ${clockClass(quality)}`}>{result.warning}</p>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}

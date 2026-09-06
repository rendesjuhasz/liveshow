"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";

type MineQuestion = {
    id: string;
    text: string;
    status?: string;
    statusLabel?: string;
    createdAt?: string;
};

const SUPPORT_KINDS = [
    { id: "opinion", label: "Vélemény" },
    { id: "feedback", label: "Visszajelzés" },
    { id: "thanks", label: "Köszönet" },
    { id: "support", label: "Extra jegy" },
] as const;

export default function ShowTalk({
    showId,
    canAsk = false,
}: {
    showId: string;
    canAsk?: boolean;
}) {
    const { user } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);
    const [mine, setMine] = useState<MineQuestion[]>([]);
    const [qText, setQText] = useState("");
    const [supportKind, setSupportKind] = useState<(typeof SUPPORT_KINDS)[number]["id"]>("thanks");
    const [supportText, setSupportText] = useState("");
    const [qError, setQError] = useState("");
    const [sError, setSError] = useState("");
    const [qBusy, setQBusy] = useState(false);
    const [sBusy, setSBusy] = useState(false);
    const [sOk, setSOk] = useState("");

    async function load() {
        const qs = await apiFetch(`/questions?showId=${encodeURIComponent(showId)}`);
        setPendingCount(Number(qs?.pendingCount || 0));
        if (user) {
            const own = await apiFetch(`/questions/mine?showId=${encodeURIComponent(showId)}`);
            setMine(Array.isArray(own) ? own : []);
        } else {
            setMine([]);
        }
    }

    useEffect(() => {
        load().catch(() => undefined);
        const t = setInterval(() => load().catch(() => undefined), 4000);
        return () => clearInterval(t);
    }, [showId, user?.id]);

    async function sendQuestion(e: React.FormEvent) {
        e.preventDefault();
        setQError("");
        const leak = contactLeakWarning(qText);
        if (leak) {
            setQError(leak);
            return;
        }
        setQBusy(true);
        try {
            await apiFetch("/questions", {
                method: "POST",
                body: JSON.stringify({ showId, text: qText }),
            });
            setQText("");
            await load();
        } catch (err: any) {
            setQError(err.message || "A kérdés beküldése nem sikerült.");
        } finally {
            setQBusy(false);
        }
    }

    async function sendSupport(e: React.FormEvent) {
        e.preventDefault();
        setSError("");
        setSOk("");
        const leak = contactLeakWarning(supportText);
        if (leak) {
            setSError(leak);
            return;
        }
        setSBusy(true);
        try {
            const res = await apiFetch(`/shows/${encodeURIComponent(showId)}/support`, {
                method: "POST",
                body: JSON.stringify({ kind: supportKind, text: supportText }),
            });
            setSupportText("");
            setSOk(
                res?.extraTicketHint
                    ? "Köszönjük a támogatási szándékot. Extra jegyet a műsor oldalán tudsz venni."
                    : "Elküldve. Ez nem megy be a kérdésfolyamba.",
            );
        } catch (err: any) {
            setSError(err.message || "A visszajelzés küldése nem sikerült.");
        } finally {
            setSBusy(false);
        }
    }

    function statusClass(status?: string) {
        if (status === "fulfilled") return "text-emerald-400 border-emerald-700/50";
        if (status === "rejected") return "text-red-400 border-red-700/50";
        return "text-yellow-400 border-yellow-700/50";
    }

    return (
        <div className="grid gap-4">
            <section className="flex min-h-[18rem] flex-col rounded-xl bg-neutral-900 p-4">
                <h2 className="mb-1 text-lg font-bold">Kérdés beküldés</h2>
                <p className="mb-3 text-xs text-neutral-500">
                    Nem chat. A rendszer a hasonló kérdéseket összevonja, a streamer mindig csak a
                    legfontosabbat látja. Függőben lévő témák: {pendingCount}. E-mail, telefonszám
                    és külső chat (Telegram, WhatsApp stb.) nem küldhető.
                </p>
                <ul className="min-h-0 flex-1 space-y-2 overflow-auto text-sm">
                    {mine.length === 0 && (
                        <li className="text-neutral-400">Még nem küldtél be kérdést ehhez a műsorhoz.</li>
                    )}
                    {mine.map((q) => (
                        <li
                            key={q.id}
                            className={`rounded border bg-neutral-800/80 p-2 ${statusClass(q.status)}`}
                        >
                            <span className="text-xs font-semibold">{q.statusLabel || "Függőben"}</span>
                            <p className="mt-1 text-white">{q.text}</p>
                            {(!q.status || q.status === "pending") && (
                                <p className="mt-1 text-xs text-neutral-500">
                                    A jegy még nincs levonva. A streamer a saját felületén veszi elő
                                    a kérdést (
                                    <Link href="/streamer/questions" className="text-accent">
                                        Aktuális kérdés
                                    </Link>
                                    ).
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
                {user && canAsk ? (
                    <form onSubmit={sendQuestion} className="mt-3 grid gap-2">
                        {qError && <p className="text-sm text-red-400">{qError}</p>}
                        <ContactLeakHint warning={contactLeakWarning(qText)} />
                        <div className="flex gap-2">
                            <input
                                className="flex-1 rounded p-2 text-black"
                                value={qText}
                                onChange={(e) => setQText(e.target.value)}
                                placeholder="Kérdés a műsorhoz"
                                minLength={8}
                                maxLength={400}
                                required
                            />
                            <button
                                type="submit"
                                disabled={qBusy}
                                className="rounded bg-blue-600 px-3 font-semibold disabled:opacity-50"
                            >
                                Beküldés
                            </button>
                        </div>
                    </form>
                ) : user ? (
                    <p className="mt-3 text-sm text-neutral-400">
                        Kérdésbeküldéshez jegycsomag kell (közös egyenleg). A jegy csak akkor
                        vonódik le, ha a streamer megválaszolja a kérdést.{" "}
                        <Link href={`/shows/${showId}`} className="text-accent">
                            Csomag vásárlása
                        </Link>
                    </p>
                ) : (
                    <p className="mt-3 text-sm text-neutral-400">Kérdéshez jelentkezz be.</p>
                )}
            </section>

            <section className="flex flex-col rounded-xl bg-neutral-900 p-4">
                <h2 className="mb-1 text-lg font-bold">Visszajelzés és támogatás</h2>
                <p className="mb-3 text-xs text-neutral-500">
                    Külön csatorna. Élő és leállított adás után is küldhető, nem kerül a
                    kérdésfolyamba.
                </p>
                {user ? (
                    <form onSubmit={sendSupport} className="grid gap-2">
                        {sError && <p className="text-sm text-red-400">{sError}</p>}
                        {sOk && <p className="text-sm text-emerald-400">{sOk}</p>}
                        <ContactLeakHint warning={contactLeakWarning(supportText)} />
                        <div className="flex flex-wrap gap-2">
                            {SUPPORT_KINDS.map((k) => (
                                <button
                                    key={k.id}
                                    type="button"
                                    onClick={() => setSupportKind(k.id)}
                                    className={`rounded-lg px-3 py-1 text-sm ${
                                        supportKind === k.id ? "bg-accent text-black" : "bg-neutral-800"
                                    }`}
                                >
                                    {k.label}
                                </button>
                            ))}
                        </div>
                        <textarea
                            className="min-h-20 rounded p-2 text-black"
                            value={supportText}
                            onChange={(e) => setSupportText(e.target.value)}
                            placeholder={
                                supportKind === "support"
                                    ? "Opcionális üzenet a támogatáshoz"
                                    : "Írj véleményt, visszajelzést vagy köszönetet"
                            }
                            maxLength={800}
                            required={supportKind !== "support"}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="submit"
                                disabled={sBusy}
                                className="rounded bg-neutral-700 px-3 py-2 font-semibold disabled:opacity-50"
                            >
                                Küldés
                            </button>
                            {supportKind === "support" && (
                                <Link href={`/shows/${showId}`} className="text-sm text-accent">
                                    Extra jegy vásárlása
                                </Link>
                            )}
                        </div>
                    </form>
                ) : (
                    <p className="text-sm text-neutral-400">Visszajelzéshez jelentkezz be.</p>
                )}
            </section>
        </div>
    );
}

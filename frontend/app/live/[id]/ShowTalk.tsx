"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";
import TicketPackShop from "@/components/TicketPackShop";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import { useT } from "@/lib/i18n/I18nProvider";
import { giftTicketLines } from "@/lib/gift-ticket-hint";

type MineQuestion = {
    id: string;
    text: string;
    status?: string;
    statusLabel?: string;
    createdAt?: string;
};


export default function ShowTalk({
    showId,
    canAsk = false,
    ownShow = false,
    live = true,
    variant = "card",
}: {
    showId: string;
    canAsk?: boolean;
    ownShow?: boolean;
    live?: boolean;
    variant?: "card" | "plain";
}) {
    const { user, status } = useAuth();
    const { t } = useT();
    const authed = status === "authenticated" && Boolean(user);
    const [pendingCount, setPendingCount] = useState(0);
    const [onAir, setOnAir] = useState<{ text?: string; supportCount?: number } | null>(null);
    const [ticketBalance, setTicketBalance] = useState(0);
    const [giftBalance, setGiftBalance] = useState(0);
    const [giftSpendsRemaining, setGiftSpendsRemaining] = useState(0);
    const [mine, setMine] = useState<MineQuestion[]>([]);
    const [qText, setQText] = useState("");
    const [qError, setQError] = useState("");
    const [qBusy, setQBusy] = useState(false);
    const [qOk, setQOk] = useState("");

    async function load() {
        const qs = await apiFetch(`/questions?showId=${encodeURIComponent(showId)}`).catch(() => null);
        setPendingCount(Number(qs?.pendingCount || 0));
        setOnAir(qs?.current?.text ? qs.current : null);
        if (user) {
            const [own, wallet] = await Promise.all([
                apiFetch(`/questions/mine?showId=${encodeURIComponent(showId)}`).catch(() => []),
                apiFetch(`/tickets/balance?showId=${encodeURIComponent(showId)}`).catch(() => null),
            ]);
            setMine(Array.isArray(own) ? own : []);
            setTicketBalance(Number(wallet?.usableOnShow ?? wallet?.balance) || 0);
            setGiftBalance(Number(wallet?.giftBalance) || 0);
            setGiftSpendsRemaining(Number(wallet?.giftSpendsRemaining) || 0);
        } else {
            setMine([]);
            setTicketBalance(0);
            setGiftBalance(0);
            setGiftSpendsRemaining(0);
        }
    }

    useEffect(() => {
        load().catch(() => undefined);
        const timer = setInterval(() => load().catch(() => undefined), live ? 4000 : 10_000);
        return () => clearInterval(timer);
    }, [showId, user?.id, live]);

    async function sendQuestion(e: React.FormEvent) {
        e.preventDefault();
        setQError("");
        setQOk("");
        const leak = contactLeakWarning(qText);
        if (leak) {
            setQError(leak);
            return;
        }
        if (qText.trim().length < 8) {
            setQError(t("talk.tooShort"));
            return;
        }
        if (user?.emailVerified === false) {
            setQError(t("talk.verify"));
            return;
        }
        setQBusy(true);
        try {
            await apiFetch("/questions", {
                method: "POST",
                body: JSON.stringify({ showId, text: qText.trim() }),
            });
            setQText("");
            setQOk(t("talk.sent"));
            await load();
        } catch (err: any) {
            setQError(err.message || t("talk.failed"));
        } finally {
            setQBusy(false);
        }
    }

    function statusClass(status?: string) {
        if (status === "fulfilled") return "text-emerald-400 border-emerald-700/50";
        if (status === "rejected") return "text-red-400 border-red-700/50";
        if (status === "missed") return "text-zinc-400 border-white/15";
        return "text-yellow-400 border-yellow-700/50";
    }

    const giftHint = giftTicketLines(giftBalance, giftSpendsRemaining);
    const plain = variant === "plain";

    return (
        <div className={plain ? "grid gap-3" : "grid gap-4"}>
            <section
                className={
                    plain
                        ? "flex min-h-0 flex-col p-0"
                        : "flex min-h-[18rem] flex-col rounded-2xl bg-card p-4 shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
                }
            >
                {plain ? null : <h2 className="mb-1 text-lg font-bold">{t("talk.title")}</h2>}
                <p className="mb-3 text-xs text-neutral-500">{t("talk.intro").replace("{n}", String(pendingCount))}</p>
                {onAir?.text ? (
                    <div className="mb-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{t("talk.onAir")}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{onAir.text}</p>
                    </div>
                ) : null}
                {!ownShow && user?.emailVerified === false ? (
                    <div className="mb-3 overflow-hidden rounded-xl">
                        <EmailVerifyBanner />
                    </div>
                ) : null}
                <ul className="min-h-0 flex-1 space-y-2 overflow-auto text-sm">
                    {mine.length === 0 && (
                        <li className="text-neutral-400">{t("talk.empty")}</li>
                    )}
                    {mine.map((q) => (
                        <li
                            key={q.id}
                            className={`rounded-xl bg-white/5 p-2 ${statusClass(q.status)}`}
                        >
                            <span className="text-xs font-semibold">{q.statusLabel || t("talk.pending")}</span>
                            <p className="mt-1 text-white">{q.text}</p>
                            {(!q.status || q.status === "pending") && (
                                <p className="mt-1 text-xs text-neutral-500">{t("talk.ticketHold")}</p>
                            )}
                            {q.status === "missed" && (
                                <p className="mt-1 text-xs text-neutral-500">{t("talk.missed")}</p>
                            )}
                        </li>
                    ))}
                </ul>
                {ownShow ? (
                    <p className="mt-3 text-sm text-neutral-400">{t("talk.ownShow")}</p>
                ) : authed && canAsk ? (
                    <form onSubmit={sendQuestion} className="mt-3 grid gap-2">
                        {!live ? <p className="text-sm text-neutral-400">{t("talk.ended")}</p> : null}
                        {qError && <p className="text-sm text-red-400">{qError}</p>}
                        {qOk && <p className="text-sm text-emerald-400">{qOk}</p>}
                        <ContactLeakHint warning={contactLeakWarning(qText)} />
                        {ticketBalance > 0 ? (
                            <p className="text-xs text-neutral-500">{t("talk.balance").replace("{n}", String(ticketBalance))}</p>
                        ) : (
                            <p className="text-sm text-neutral-400">{t("talk.needTicket")}</p>
                        )}
                        {giftHint ? (
                            <>
                                <p className="text-xs text-neutral-500">
                                    {t("talk.giftBalance").replace("{n}", String(giftHint.giftBalance))}
                                </p>
                                <p className="text-xs text-neutral-500">
                                    {t("talk.giftUsableOnShow").replace("{n}", String(giftHint.usableOnThisShow))}
                                </p>
                            </>
                        ) : null}
                        <div className="flex gap-2">
                            <input
                                className="flex-1 rounded-xl bg-[#323232] px-3 py-2 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] placeholder:text-muted"
                                value={qText}
                                onChange={(e) => setQText(e.target.value)}
                                placeholder={t("talk.placeholder")}
                                minLength={8}
                                maxLength={400}
                                required
                            />
                            <button
                                type="submit"
                                disabled={qBusy}
                                className="rounded-xl bg-primary px-3 font-semibold text-[#0b1220] disabled:opacity-50"
                            >
                                {t("talk.submit")}
                            </button>
                        </div>
                        {ticketBalance < 1 ? <TicketPackShop compact onBought={() => void load()} /> : null}
                    </form>
                ) : status === "loading" ? (
                    <p className="mt-3 text-sm text-neutral-500">{t("common.loading")}</p>
                ) : (
                    <p className="mt-3 text-sm text-neutral-400">
                        <Link href={`/login?next=/live/${encodeURIComponent(showId)}`} className="text-accent">
                            {t("talk.loginAction")}
                        </Link>
                        {` — ${t("talk.login")}`}
                    </p>
                )}
            </section>
        </div>
    );
}

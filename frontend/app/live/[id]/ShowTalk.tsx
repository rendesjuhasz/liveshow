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

const SUPPORT_KINDS = ["opinion", "feedback", "thanks", "support"] as const;

export default function ShowTalk({
    showId,
    canAsk = false,
    ownShow = false,
    live = true,
}: {
    showId: string;
    canAsk?: boolean;
    ownShow?: boolean;
    live?: boolean;
}) {
    const { user, status } = useAuth();
    const { t } = useT();
    const authed = status === "authenticated" && Boolean(user);
    const [pendingCount, setPendingCount] = useState(0);
    const [ticketBalance, setTicketBalance] = useState(0);
    const [giftBalance, setGiftBalance] = useState(0);
    const [giftSpendsRemaining, setGiftSpendsRemaining] = useState(0);
    const [mine, setMine] = useState<MineQuestion[]>([]);
    const [qText, setQText] = useState("");
    const [supportKind, setSupportKind] = useState<(typeof SUPPORT_KINDS)[number]>("thanks");
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
            const wallet = await apiFetch(`/tickets/balance?showId=${encodeURIComponent(showId)}`).catch(() => null);
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
        const timer = setInterval(() => load().catch(() => undefined), 10_000);
        return () => clearInterval(timer);
    }, [showId, user?.id]);

    async function sendQuestion(e: React.FormEvent) {
        e.preventDefault();
        setQError("");
        const leak = contactLeakWarning(qText);
        if (leak) {
            setQError(leak);
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
                body: JSON.stringify({ showId, text: qText }),
            });
            setQText("");
            await load();
        } catch (err: any) {
            setQError(err.message || t("talk.failed"));
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
        if (user?.emailVerified === false) {
            setSError(t("talk.verify"));
            return;
        }
        setSBusy(true);
        try {
            const res = await apiFetch(`/shows/${encodeURIComponent(showId)}/support`, {
                method: "POST",
                body: JSON.stringify({ kind: supportKind, text: supportText }),
            });
            setSupportText("");
            await load();
            setSOk(
                res?.spentTicket
                    ? "Köszönjük. 1 jegy levonva támogatásként a kérdésjegyeidből. Nem került a kérdésfolyamba."
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
        if (status === "missed") return "text-zinc-400 border-white/15";
        return "text-yellow-400 border-yellow-700/50";
    }

    const giftHint = giftTicketLines(giftBalance, giftSpendsRemaining);

    return (
        <div className="grid gap-4">
            <section className="flex min-h-[18rem] flex-col rounded-2xl bg-card p-4 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
                <h2 className="mb-1 text-lg font-bold">{t("talk.title")}</h2>
                <p className="mb-3 text-xs text-neutral-500">{t("talk.intro").replace("{n}", String(pendingCount))}</p>
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
                ) : !live ? (
                    <p className="mt-3 text-sm text-neutral-400">{t("talk.ended")}</p>
                ) : authed && canAsk && ticketBalance > 0 ? (
                    <form onSubmit={sendQuestion} className="mt-3 grid gap-2">
                        {qError && <p className="text-sm text-red-400">{qError}</p>}
                        <ContactLeakHint warning={contactLeakWarning(qText)} />
                        <p className="text-xs text-neutral-500">{t("talk.balance").replace("{n}", String(ticketBalance))}</p>
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
                    </form>
                ) : authed ? (
                    <div className="mt-3 grid gap-3">
                        <p className="text-sm text-neutral-400">{t("talk.needTicket")}</p>
                        <TicketPackShop compact onBought={() => void load()} />
                    </div>
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

            <section className="flex flex-col rounded-2xl bg-card p-4 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
                <h2 className="mb-1 text-lg font-bold">{t("support.title")}</h2>
                <p className="mb-3 text-xs text-neutral-500">{t("support.intro")}</p>
                {authed ? (
                    <form onSubmit={sendSupport} className="grid gap-2">
                        {sError && <p className="text-sm text-red-400">{sError}</p>}
                        {sOk && <p className="text-sm text-emerald-400">{sOk}</p>}
                        <ContactLeakHint warning={contactLeakWarning(supportText)} />
                        <div className="flex flex-wrap gap-2">
                            {SUPPORT_KINDS.map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setSupportKind(k)}
                                    className={`rounded-lg px-3 py-1 text-sm ${
                                        supportKind === k ? "bg-accent text-black" : "bg-neutral-800"
                                    }`}
                                >
                                    {t(`support.${k}`)}
                                </button>
                            ))}
                        </div>
                        <textarea
                            className="min-h-20 rounded-xl bg-[#323232] p-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] placeholder:text-muted"
                            value={supportText}
                            onChange={(e) => setSupportText(e.target.value)}
                            placeholder={
                                supportKind === "support"
                                    ? t("support.placeholderSupport")
                                    : t("support.placeholder")
                            }
                            maxLength={800}
                            required={supportKind !== "support"}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="submit"
                                disabled={sBusy || (supportKind === "support" && ticketBalance < 1)}
                                className="rounded-xl bg-primary px-3 py-2 font-semibold text-[#0b1220] disabled:opacity-50"
                            >
                                {supportKind === "support" ? t("support.sendTicket") : t("support.send")}
                            </button>
                        </div>
                        {supportKind === "support" && ticketBalance < 1 ? (
                            <div className="grid gap-2">
                                <TicketPackShop compact onBought={() => void load()} />
                            </div>
                        ) : null}
                    </form>
                ) : status === "loading" ? (
                    <p className="text-sm text-neutral-500">{t("common.loading")}</p>
                ) : (
                    <p className="text-sm text-neutral-400">{t("support.login")}</p>
                )}
            </section>
        </div>
    );
}

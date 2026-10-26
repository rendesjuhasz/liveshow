"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Gift, Minus, Plus, X } from "lucide-react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import TicketPackShop from "@/components/TicketPackShop";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import { useT } from "@/lib/i18n/I18nProvider";
import LocaleLink from "@/components/LocaleLink";

const BTN =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] active:scale-95";

const PRESETS = [1, 5, 10, 20];

export default function ViewerSupportMenu({ showId }: { showId: string }) {
    const { t } = useT();
    const { user, status } = useAuth();
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [tickets, setTickets] = useState(1);
    const [balance, setBalance] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [ok, setOk] = useState("");

    const authed = status === "authenticated" && Boolean(user);
    const max = Math.min(20, Math.max(1, balance || 20));

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open, mounted]);

    useEffect(() => {
        if (!open || !authed) return;
        apiFetch(`/tickets/balance?showId=${encodeURIComponent(showId)}`)
            .then((wallet) => {
                const usable = Number(wallet?.usableOnShow ?? wallet?.balance) || 0;
                setBalance(usable);
                setTickets((n) => Math.min(Math.max(1, n), Math.max(1, usable || 1)));
            })
            .catch(() => setBalance(0));
    }, [open, authed, showId]);

    async function send() {
        setError("");
        setOk("");
        if (user?.emailVerified === false) {
            setError(t("talk.verify"));
            return;
        }
        setBusy(true);
        try {
            const res = await apiFetch(`/shows/${encodeURIComponent(showId)}/support`, {
                method: "POST",
                body: JSON.stringify({ kind: "support", tickets, text: "" }),
            });
            const spent = Number(res?.ticketsSpent) || tickets;
            if (typeof res?.ticketBalance === "number") setBalance(res.ticketBalance);
            setOk(t("support.thanksSpent").replace("{n}", String(spent)));
        } catch (err: any) {
            setError(err.message || t("talk.failed"));
        } finally {
            setBusy(false);
        }
    }

    function onDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const rect = dialog.getBoundingClientRect();
        const outside =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;
        if (outside) setOpen(false);
    }

    return (
        <>
            <button type="button" className={BTN} aria-label={t("support.title")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
                <Gift className="size-5" aria-hidden />
            </button>
            {mounted && open
                ? createPortal(
                      <dialog
                          ref={dialogRef}
                          className="viewer-share-dialog"
                          aria-labelledby={titleId}
                          onCancel={(event) => {
                              event.preventDefault();
                              setOpen(false);
                          }}
                          onClose={() => setOpen(false)}
                          onClick={onDialogClick}
                      >
                          <div className="mb-3 flex items-center justify-between">
                              <h2 id={titleId} className="text-lg font-bold text-white">
                                  {t("support.title")}
                              </h2>
                              <button
                                  type="button"
                                  className="flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                                  aria-label={t("share.close")}
                                  onClick={() => setOpen(false)}
                              >
                                  <X className="size-5" />
                              </button>
                          </div>
                          <p className="mb-3 text-sm text-zinc-300">{t("support.intro")}</p>
                          {!authed ? (
                              <p className="text-sm text-zinc-300">
                                  <LocaleLink href={`/login?next=/live/${encodeURIComponent(showId)}`} className="text-accent">
                                      {t("talk.loginAction")}
                                  </LocaleLink>
                                  {` — ${t("support.login")}`}
                              </p>
                          ) : (
                              <div className="grid gap-3">
                                  {user?.emailVerified === false ? <EmailVerifyBanner /> : null}
                                  {error ? <p className="text-sm text-red-400">{error}</p> : null}
                                  {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
                                  <p className="text-sm font-semibold">{t("support.amount")}</p>
                                  <p className="text-xs text-zinc-400">{t("talk.balance").replace("{n}", String(balance))}</p>
                                  <div className="flex items-center justify-center gap-3">
                                      <button
                                          type="button"
                                          className={BTN}
                                          aria-label="-"
                                          onClick={() => setTickets((n) => Math.max(1, n - 1))}
                                      >
                                          <Minus className="size-5" />
                                      </button>
                                      <span className="min-w-10 text-center text-2xl font-bold tabular-nums">{tickets}</span>
                                      <button
                                          type="button"
                                          className={BTN}
                                          aria-label="+"
                                          onClick={() => setTickets((n) => Math.min(max, n + 1))}
                                      >
                                          <Plus className="size-5" />
                                      </button>
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-2">
                                      {PRESETS.map((n) => (
                                          <button
                                              key={n}
                                              type="button"
                                              disabled={balance > 0 && n > balance}
                                              onClick={() => setTickets(Math.min(n, max))}
                                              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                                                  tickets === n ? "bg-accent text-black" : "bg-black text-white"
                                              }`}
                                          >
                                              {n}
                                          </button>
                                      ))}
                                  </div>
                                  <button
                                      type="button"
                                      disabled={busy || balance < 1}
                                      onClick={() => void send()}
                                      className="rounded-xl bg-primary px-3 py-2 font-semibold text-[#0b1220] disabled:opacity-50"
                                  >
                                      {t("support.sendTicket").replace("{n}", String(tickets))}
                                  </button>
                                  {balance < 1 ? (
                                      <TicketPackShop
                                          compact
                                          onBought={() => {
                                              apiFetch(`/tickets/balance?showId=${encodeURIComponent(showId)}`)
                                                  .then((wallet) => setBalance(Number(wallet?.usableOnShow ?? wallet?.balance) || 0))
                                                  .catch(() => undefined);
                                          }}
                                      />
                                  ) : null}
                              </div>
                          )}
                      </dialog>,
                      document.body,
                  )
                : null}
        </>
    );
}

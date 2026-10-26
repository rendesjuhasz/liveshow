"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";
import { useT } from "@/lib/i18n/I18nProvider";
import LocaleLink from "@/components/LocaleLink";

const KINDS = ["thanks", "opinion", "feedback"] as const;

export default function WatchFeedbackPrompt({
    showId,
    open,
    onClose,
}: {
    showId: string;
    open: boolean;
    onClose: () => void;
}) {
    const { t } = useT();
    const { user, status } = useAuth();
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [mounted, setMounted] = useState(false);
    const [writing, setWriting] = useState(false);
    const [kind, setKind] = useState<(typeof KINDS)[number]>("thanks");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [ok, setOk] = useState("");
    const authed = status === "authenticated" && Boolean(user);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) {
            setWriting(false);
            setError("");
            setOk("");
            setText("");
        }
    }, [open]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || !mounted) return;
        if (open) {
            const show = () => {
                if (!dialog.isConnected) return;
                try {
                    if (!dialog.open) dialog.showModal();
                } catch {
                    dialog.setAttribute("open", "");
                }
            };
            show();
            const frame = window.requestAnimationFrame(show);
            return () => window.cancelAnimationFrame(frame);
        }
        if (dialog.open) dialog.close();
        else dialog.removeAttribute("open");
    }, [open, mounted]);

    async function send(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setOk("");
        const leak = contactLeakWarning(text);
        if (leak) {
            setError(leak);
            return;
        }
        if (text.trim().length < 4) {
            setError(t("talk.tooShort"));
            return;
        }
        if (user?.emailVerified === false) {
            setError(t("talk.verify"));
            return;
        }
        setBusy(true);
        try {
            await apiFetch(`/shows/${encodeURIComponent(showId)}/support`, {
                method: "POST",
                body: JSON.stringify({ kind, text }),
            });
            setText("");
            setOk("Elküldve. Ez nem megy be a kérdésfolyamba.");
        } catch (err: any) {
            setError(err.message || "A visszajelzés küldése nem sikerült.");
        } finally {
            setBusy(false);
        }
    }

    if (!mounted) return null;

    return createPortal(
        <dialog
            ref={dialogRef}
            className="viewer-share-dialog"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                if (open) onClose();
            }}
            onClose={() => {
                if (open) onClose();
            }}
        >
            <div className="mb-3 flex items-center justify-between">
                <h2 id={titleId} className="text-lg font-bold text-white">
                    {t("support.headline")}
                </h2>
                <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                    aria-label={t("share.close")}
                    onClick={onClose}
                >
                    <X className="size-5" />
                </button>
            </div>
            <p className="mb-4 text-sm text-zinc-200">A visszajelzés nem kerül a kérdésfolyamba.</p>
            {!writing ? (
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="rounded-xl bg-primary px-3 py-2 font-semibold text-[#0b1220]"
                        onClick={() => setWriting(true)}
                    >
                        {t("support.write")}
                    </button>
                    <button type="button" className="rounded-xl bg-black px-3 py-2 font-semibold text-white" onClick={onClose}>
                        {t("support.skip")}
                    </button>
                </div>
            ) : !authed ? (
                <p className="text-sm text-zinc-300">
                    <LocaleLink href={`/login?next=/live/${encodeURIComponent(showId)}`} className="text-accent">
                        {t("talk.loginAction")}
                    </LocaleLink>
                    {` — ${t("support.login")}`}
                </p>
            ) : (
                <form onSubmit={send} className="grid gap-2">
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
                    <ContactLeakHint warning={contactLeakWarning(text)} />
                    <div className="flex flex-wrap gap-2">
                        {KINDS.map((k) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setKind(k)}
                                className={`rounded-lg px-3 py-1 text-sm ${kind === k ? "bg-accent text-black" : "bg-black text-white"}`}
                            >
                                {t(`support.${k}`)}
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="min-h-20 rounded-xl bg-black p-3 text-white"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={t("support.placeholder")}
                        maxLength={800}
                        required
                    />
                    <button type="submit" disabled={busy} className="rounded-xl bg-primary px-3 py-2 font-semibold text-[#0b1220] disabled:opacity-50">
                        {t("support.send")}
                    </button>
                </form>
            )}
        </dialog>,
        document.body,
    );
}

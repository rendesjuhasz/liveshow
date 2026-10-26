"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";
import ReportButton from "@/components/ReportButton";
import { useT } from "@/lib/i18n/I18nProvider";
import { connectLiveSocket } from "@/lib/live-socket";

type ChatRow = {
    id: string;
    text: string;
    createdAt?: string;
    author?: string;
};

function LiveChat({ showId, live }: { showId: string; live: boolean }) {
    const { user, status } = useAuth();
    const { t } = useT();
    const authed = status === "authenticated" && Boolean(user);
    const [rows, setRows] = useState<ChatRow[]>([]);
    const [text, setText] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        const data = await apiFetch(`/shows/${encodeURIComponent(showId)}/chat`);
        setRows(Array.isArray(data) ? [...data].reverse() : []);
    }, [showId]);

    useEffect(() => {
        load().catch(() => undefined);
        let cancelled = false;
        let sock: { disconnect: () => void; on: Function; emit: Function } | null = null;
        void connectLiveSocket(false)
            .then((s) => {
                if (cancelled) {
                    s.disconnect();
                    return;
                }
                sock = s;
                const join = () => s.emit("live:chat-join", { showId });
                s.on("connect", join);
                if (s.connected) join();
                s.on("live:chat", (msg: ChatRow) => {
                    if (!msg?.id) return;
                    setRows((prev) => (prev.some((row) => row.id === msg.id) ? prev : [...prev, msg]));
                });
            })
            .catch(() => undefined);
        const timer = setInterval(() => load().catch(() => undefined), 20_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
            sock?.disconnect();
        };
    }, [showId, load]);

    async function send(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        const leak = contactLeakWarning(text);
        if (leak) {
            setError(leak);
            return;
        }
        if (user?.emailVerified === false) {
            setError(t("talk.verify"));
            return;
        }
        setBusy(true);
        try {
            await apiFetch(`/shows/${encodeURIComponent(showId)}/chat`, {
                method: "POST",
                body: JSON.stringify({ text }),
            });
            setText("");
            await load();
        } catch (err: any) {
            setError(err.message || t("talk.failed"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="mt-3 flex min-h-0 flex-col bg-transparent p-0 shadow-none">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/70 drop-shadow">{t("chat.title")}</h2>
            <p className="mb-2 text-[11px] text-white/45">{t("chat.intro")}</p>
            <ul className="min-h-0 max-h-28 flex-1 space-y-1 overflow-auto text-sm">
                {rows.length === 0 && <li className="text-white/45 drop-shadow">{t("chat.empty")}</li>}
                {rows.map((row) => (
                    <li key={row.id} className="rounded-none bg-transparent p-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                        <div className="flex items-start justify-between gap-2">
                            <p>
                                <span className="text-xs text-white/55">{row.author || t("chat.viewer")} · </span>
                                {row.text}
                            </p>
                            <ReportButton targetType="chat" targetId={row.id} />
                        </div>
                    </li>
                ))}
            </ul>
            {!live ? (
                <p className="mt-3 text-sm text-white/55">{t("chat.closed")}</p>
            ) : authed ? (
                <form onSubmit={send} className="mt-3 grid gap-2">
                    {error && (
                        <p
                            role="alert"
                            data-live-chat-error
                            className="mb-0 rounded-lg border border-white/25 bg-black px-2.5 py-1.5 text-sm font-semibold leading-snug text-[#ff8a94] shadow-[0_8px_24px_rgba(0,0,0,0.9)]"
                        >
                            {error}
                        </p>
                    )}
                    <ContactLeakHint warning={contactLeakWarning(text)} />
                    <div className="flex gap-2">
                        <input
                            className="flex-1 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl placeholder:text-white/45"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={t("chat.placeholder")}
                            maxLength={280}
                            required
                        />
                        <button
                            type="submit"
                            disabled={busy}
                            className="rounded-full bg-gradient-to-r from-[#25f4ee] to-[#fe2c55] px-4 font-semibold text-white shadow-[0_8px_20px_rgba(254,44,85,0.35)] disabled:opacity-50"
                        >
                            {t("chat.send")}
                        </button>
                    </div>
                </form>
            ) : status === "loading" ? (
                <p className="mt-3 text-sm text-white/45">{t("common.loading")}</p>
            ) : (
                <p className="mt-3 text-sm text-white/55">{t("chat.login")}</p>
            )}
        </section>
    );
}

export default memo(LiveChat);

"use client";

import { useState } from "react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/lib/i18n/I18nProvider";

const REASONS = [
    { id: "spam", label: "Spam / reklám" },
    { id: "harassment", label: "Zaklatás / sértő" },
    { id: "illegal", label: "Jogellenes tartalom" },
    { id: "off_platform", label: "Külső kapcsolat / átverés" },
    { id: "other", label: "Egyéb" },
] as const;

export default function ReportButton({
    targetType,
    targetId,
    label,
}: {
    targetType: "question" | "review" | "streamer" | "show" | "chat";
    targetId: string;
    label?: string;
}) {
    const { user } = useAuth();
    const { t } = useT();
    const caption = label || t("report.cta");
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<(typeof REASONS)[number]["id"]>("spam");
    const [details, setDetails] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    if (!user || !targetId) return null;

    async function send(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setMsg("");
        try {
            await apiFetch("/reports", {
                method: "POST",
                body: JSON.stringify({ targetType, targetId, reason, details }),
            });
            setMsg("Elküldve. A moderátorok átnézik.");
            setOpen(false);
            setDetails("");
        } catch (err: any) {
            setMsg(err.message || "A jelentés nem sikerült.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="inline-block">
            <button
                type="button"
                className="text-xs text-neutral-500 underline-offset-2 hover:text-red-400 hover:underline"
                onClick={() => {
                    setOpen((v) => !v);
                    setMsg("");
                }}
            >
                {caption}
            </button>
            {msg && <p className="mt-1 text-xs text-neutral-400">{msg}</p>}
            {open && (
                <form
                    onSubmit={send}
                    className="mt-2 grid max-w-xs gap-2 rounded-xl border border-white/10 bg-neutral-950 p-3 text-left"
                >
                    <select
                        className="rounded bg-neutral-800 p-2 text-sm text-white"
                        value={reason}
                        onChange={(e) => setReason(e.target.value as typeof reason)}
                    >
                        {REASONS.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                    <textarea
                        className="min-h-16 rounded bg-neutral-800 p-2 text-sm"
                        placeholder="Rövid indok (opcionális)"
                        maxLength={500}
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={busy}
                        className="rounded bg-red-700 px-3 py-1 text-sm font-semibold disabled:opacity-50"
                    >
                        {busy ? "Küldés..." : "Jelentés küldése"}
                    </button>
                </form>
            )}
        </div>
    );
}

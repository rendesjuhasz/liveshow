"use client";

import { useState } from "react";
import LocaleLink from "@/components/LocaleLink";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";

export default function EmailVerifyBanner() {
    const { user, refreshUser } = useAuth();
    const { t } = useT();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    if (!user || user.emailVerified !== false) return null;

    async function resend() {
        setBusy(true);
        setMessage("");
        try {
            const data = await apiFetch("/auth/resend-verification", {
                method: "POST",
                body: JSON.stringify({}),
            });
            setMessage(data?.message || t("verify.done"));
            await refreshUser().catch(() => undefined);
        } catch (err: unknown) {
            const text =
                err && typeof err === "object" && "message" in err
                    ? String((err as Error).message)
                    : t("verify.failed");
            setMessage(text);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p>{t("verify.banner").replace("{email}", user.email)}</p>
                <div className="flex shrink-0 items-center gap-3">
                    {message && <span className="text-xs text-zinc-300">{message}</span>}
                    <Button type="button" variant="gold" className="h-9 px-3 text-xs" disabled={busy} onClick={resend}>
                        {busy ? t("verify.resendBusy") : t("verify.resend")}
                    </Button>
                    <LocaleLink href="/verify-email" className="text-xs underline">
                        {t("verify.open")}
                    </LocaleLink>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/api/http";
import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import PasswordField from "@/components/PasswordField";
import LocaleLink from "@/components/LocaleLink";
import { useT } from "@/lib/i18n/I18nProvider";

export default function ResetPasswordForm() {
    const params = useSearchParams();
    const token = (params.get("token") || "").trim();
    const { login } = useAuth();
    const { t } = useT();
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (password.length < 8) {
            setError(t("auth.passwordMin"));
            return;
        }
        if (password !== passwordConfirm) {
            setError(t("auth.passwordMismatch"));
            return;
        }
        if (!token) {
            setError(t("auth.resetInvalid"));
            return;
        }
        setBusy(true);
        try {
            const data = await apiFetch("/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({ token, password, passwordConfirm }),
            });
            const email = data?.user?.email;
            if (email) {
                const nextUser = await login(email, password);
                window.location.assign(
                    isAdmin(nextUser) ? "/admin" : isStreamer(nextUser) ? "/streamer" : "/",
                );
                return;
            }
            window.location.assign("/login");
        } catch (err: unknown) {
            const message =
                err && typeof err === "object" && "message" in err
                    ? String((err as Error).message)
                    : t("auth.resetError");
            setError(message);
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 sm:p-8"
            >
                <h1 className="mb-2 text-3xl font-extrabold">{t("auth.newPassword")}</h1>
                <p className="mb-6 text-sm text-zinc-400">{t("auth.resetLead")}</p>
                {!token && (
                    <p className="mb-4 text-sm text-red-400">{t("auth.resetInvalid")}</p>
                )}
                <label className="mb-4 grid gap-2 text-sm">
                    {t("auth.newPassword")}
                    <PasswordField
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    {t("auth.passwordConfirm")}
                    <PasswordField
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        autoComplete="new-password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy || !token}>
                    {busy ? t("auth.busy") : t("auth.resetSubmit")}
                </Button>
                <p className="mt-6 text-sm text-zinc-400">
                    <LocaleLink href="/login" className="text-white underline">
                        {t("auth.backToLogin")}
                    </LocaleLink>
                </p>
            </form>
        </div>
    );
}

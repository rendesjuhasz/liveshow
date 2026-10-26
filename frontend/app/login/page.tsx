"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";
import PasswordField from "@/components/PasswordField";
import SocialAuthButtons from "@/components/SocialAuthButtons";
import { safeViewerReturnPath } from "@/lib/auth-return";
import { markStreamerLoginIntent } from "@/lib/streamer-login-intent";

function LoginForm() {
    const { login } = useAuth();
    const { t } = useT();
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextPath = searchParams.get("next") || "";
    const oauthError = searchParams.get("oauthError") || "";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);

    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting.current || busy) return;
        submitting.current = true;
        setError("");
        setBusy(true);
        try {
            const nextUser = await login(email, password);
            if (isStreamer(nextUser) && !nextPath) {
                markStreamerLoginIntent();
                window.location.assign("/streamer");
                return;
            }
            if (isAdmin(nextUser) && !nextUser.streamer && !nextPath) {
                window.location.assign("/admin");
                return;
            }
            router.replace(safeViewerReturnPath(nextPath));
        } catch (err) {
            const message =
                err && typeof err === "object" && "message" in err && String((err as Error).message)
                    ? String((err as Error).message)
                    : t("auth.loginError");
            setError(message);
            setBusy(false);
            submitting.current = false;
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={handleLogin}
                className="w-full max-w-md rounded-2xl bg-card p-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] sm:p-8"
            >
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">{t("auth.viewerAccount")}</p>
                <h1 className="mb-2 text-3xl font-extrabold">{t("auth.loginTitle")}</h1>
                <p className="mb-6 text-sm text-zinc-400">{t("auth.loginLead")}</p>
                <SocialAuthButtons
                    nextPath={nextPath || undefined}
                    googleLabel={t("auth.continueGoogle")}
                    microsoftLabel={t("auth.continueMicrosoft")}
                    appleLabel={t("auth.continueApple")}
                />
                <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-zinc-500">
                    <span className="h-px flex-1 bg-white/10" />
                    {t("auth.or")}
                    <span className="h-px flex-1 bg-white/10" />
                </div>
                <label className="mb-4 grid gap-2 text-sm">
                    {t("auth.email")}
                    <input
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        type="email"
                        name="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    {t("auth.password")}
                    <PasswordField
                        name="password"
                        autoComplete="current-password"
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
                {oauthError && <p className="mb-4 text-sm text-red-400">{oauthError}</p>}
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                    {busy ? t("auth.busy") : t("auth.submitLogin")}
                </Button>
                <div className="mt-6 grid gap-1 text-sm text-zinc-400">
                    <Link href="/forgot-password" className="inline-flex min-h-11 items-center hover:text-white">
                        {t("auth.forgot")}
                    </Link>
                    <Link href="/register" className="inline-flex min-h-11 items-center hover:text-white">
                        {t("auth.noAccount")}
                    </Link>
                    <Link href="/streamer-login" className="inline-flex min-h-11 items-center hover:text-white">
                        {t("auth.streamerLoginOther")}
                    </Link>
                </div>
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<p className="p-8 text-zinc-400">…</p>}>
            <LoginForm />
        </Suspense>
    );
}

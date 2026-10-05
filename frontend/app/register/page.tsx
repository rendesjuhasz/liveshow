"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";
import PasswordField from "@/components/PasswordField";
import SocialAuthButtons from "@/components/SocialAuthButtons";

const REF_STORAGE_KEY = "liveshow_ref";

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();
    const { t } = useT();
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [refCode, setRefCode] = useState("");
    const submitting = useRef(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = String(params.get("ref") || "")
            .trim()
            .toUpperCase();
        if (fromUrl) {
            window.localStorage.setItem(REF_STORAGE_KEY, fromUrl);
            setRefCode(fromUrl);
            return;
        }
        const stored = String(window.localStorage.getItem(REF_STORAGE_KEY) || "")
            .trim()
            .toUpperCase();
        if (stored) setRefCode(stored);
    }, []);

    async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting.current || busy) return;
        submitting.current = true;
        setError("");
        setBusy(true);
        try {
            await register(email, password, name, refCode || undefined);
            window.localStorage.removeItem(REF_STORAGE_KEY);
            router.replace("/");
        } catch (err: any) {
            setError(err?.message || t("auth.registerError"));
            setBusy(false);
            submitting.current = false;
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={handleRegister}
                className="w-full max-w-md rounded-2xl bg-card p-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] sm:p-8"
            >
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">{t("auth.viewerAccount")}</p>
                <h1 className="mb-6 text-3xl font-extrabold">{t("auth.registerTitle")}</h1>
                {refCode ? (
                    <p className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
                        {t("auth.referralCode")}: {refCode}
                    </p>
                ) : null}
                <p className="mb-6 text-sm text-zinc-400">{t("auth.registerLead")}</p>
                <SocialAuthButtons
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
                    {t("auth.name")}
                    <input
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        type="text"
                        name="name"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-4 grid gap-2 text-sm">
                    {t("auth.email")}
                    <input
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    {t("auth.password")}
                    <PasswordField
                        name="password"
                        autoComplete="new-password"
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                    {busy ? t("auth.busy") : t("auth.submitRegister")}
                </Button>
                <p className="mt-6 text-sm text-zinc-400">
                    {t("auth.haveAccount")}{" "}
                    <Link href="/login" className="text-white underline">
                        {t("auth.submitLogin")}
                    </Link>
                </p>
                <p className="mt-3 text-sm">
                    <Link href="/streamer-register" className="text-accent hover:underline">
                        {t("nav.streamerRegister")}
                    </Link>
                </p>
                <p className="mt-4 text-xs text-zinc-500">
                    {t("auth.acceptPrefix")}{" "}
                    <Link href="/aszf" className="text-accent">
                        {t("legal.aszf")}
                    </Link>{" "}
                    {t("auth.acceptAnd")}{" "}
                    <Link href="/adatkezeles" className="text-accent">
                        {t("legal.privacy")}
                    </Link>{" "}
                    {t("auth.acceptSuffix")}
                </p>
            </form>
        </div>
    );
}

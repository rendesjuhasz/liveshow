"use client";

import { useState } from "react";
import Link from "next/link";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";
import LocaleLink from "@/components/LocaleLink";

function errText(err: unknown) {
    if (err && typeof err === "object" && "message" in err && String((err as Error).message)) {
        return String((err as Error).message);
    }
    return "Hiba történt a bejelentkezés során.";
}

export default function LoginPage() {
    const { login } = useAuth();
    const { t } = useT();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            const nextUser = await login(email, password);
            window.location.assign(isAdmin(nextUser) ? "/admin" : "/");
        } catch (err) {
            setError(errText(err));
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={handleLogin}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-8"
            >
                <h1 className="mb-2 text-3xl font-extrabold">{t("auth.loginTitle")}</h1>
                <p className="mb-6 text-sm text-zinc-400">
                    Előbb regisztrálj nézőként egy <strong>új emaillel</strong> (ne a streamer
                    fiókkal). Privát ablakban a fejléc „Belépés” gombja csak ide hoz; a form
                    alján lévő gomb léptet be.
                </p>
                <label className="mb-4 grid gap-2 text-sm">
                    {t("auth.email")}
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    {t("auth.password")}
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
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
                    <Link href="/streamer-login" className="inline-flex min-h-11 items-center text-accent hover:underline">
                        Streamer belépés (másik ablak)
                    </Link>
                </div>
            </form>
        </div>
    );
}

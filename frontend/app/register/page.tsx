"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";

const REF_STORAGE_KEY = "liveshow_ref";

export default function RegisterPage() {
    const { register } = useAuth();
    const { t } = useT();
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [refCode, setRefCode] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = String(params.get("ref") || "").trim().toUpperCase();
        if (fromUrl) {
            window.localStorage.setItem(REF_STORAGE_KEY, fromUrl);
            setRefCode(fromUrl);
            return;
        }
        const stored = String(window.localStorage.getItem(REF_STORAGE_KEY) || "").trim().toUpperCase();
        if (stored) setRefCode(stored);
    }, []);

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            const nextUser = await register(email, password, name, refCode || undefined);
            window.localStorage.removeItem(REF_STORAGE_KEY);
            window.location.assign(isAdmin(nextUser) ? "/admin" : "/");
        } catch (err: any) {
            setError(err?.message || "Hiba történt a regisztráció során.");
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={handleRegister}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-8"
            >
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">{t("auth.viewerAccount")}</p>
                <h1 className="mb-6 text-3xl font-extrabold">{t("auth.registerTitle")}</h1>
                {refCode && (
                    <p className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
                        Ajánlói kód: {refCode}
                    </p>
                )}
                <p className="mb-6 text-sm text-zinc-400">
                    Admin fiókhoz is ezt az űrlapot használd, email:{" "}
                    <span className="font-semibold text-white">admin@admin.com</span>
                    . A rendszer ettől a címtől admin szerepet ad, nem kell külön admin-regisztráció.
                </p>
                <label className="mb-4 grid gap-2 text-sm">
                    {t("auth.name")}
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-4 grid gap-2 text-sm">
                    Email
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    Jelszó
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        type="password"
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
                        Belépés
                    </Link>
                </p>
                <p className="mt-3 text-sm">
                    <Link href="/streamer-register" className="text-accent hover:underline">
                        Streamerként szeretnék regisztrálni
                    </Link>
                </p>
                <p className="mt-4 text-xs text-zinc-500">
                    A regisztrációval elfogadod az{" "}
                    <Link href="/aszf" className="text-accent">
                        ÁSZF
                    </Link>{" "}
                    és az{" "}
                    <Link href="/adatkezeles" className="text-accent">
                        Adatkezelési tájékoztató
                    </Link>{" "}
                    feltételeit.
                </p>
            </form>
        </div>
    );
}

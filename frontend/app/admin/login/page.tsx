"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import PasswordField from "@/components/PasswordField";
import { needsUsername } from "@/lib/username";

function errText(err: unknown) {
    if (err && typeof err === "object" && "message" in err && String((err as Error).message)) {
        return String((err as Error).message);
    }
    return "Hiba történt a bejelentkezés során.";
}

function AdminLoginForm() {
    const { login } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const forbidden = searchParams.get("error") === "forbidden";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(forbidden ? "Nincs admin jogosultság." : "");
    const [busy, setBusy] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            const nextUser = await login(email, password);
            if (needsUsername(nextUser)) {
                router.replace("/username");
                return;
            }
            if (!isAdmin(nextUser)) {
                setError("Nincs admin jogosultság.");
                setBusy(false);
                return;
            }
            router.replace("/admin");
        } catch (err) {
            setError(errText(err));
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={handleLogin}
                className="w-full max-w-md rounded-2xl bg-card p-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] sm:p-8"
            >
                <Link href="/" className="mb-6 inline-block text-sm text-accent underline">
                    Vissza a LiveShow főoldalra
                </Link>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Admin</p>
                <h1 className="mb-2 text-3xl font-extrabold">Admin belépés</h1>
                <p className="mb-6 text-sm text-zinc-400">
                    Ez a felület csak admin szerepkörű fióknak szól. Nézői belépés:{" "}
                    <Link href="/login" className="text-white underline">
                        /login
                    </Link>
                </p>
                <label className="mb-4 grid gap-2 text-sm">
                    Email
                    <input
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    Jelszó
                    <PasswordField
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                    {busy ? "Belépés..." : "Admin belépés"}
                </Button>
                <p className="mt-6 text-xs text-zinc-500">
                    Kétlépcsős azonosítás (TOTP) előkészítve, jelenleg nem kötelező. Beállítás: Admin → Biztonság.
                </p>
            </form>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<p className="p-8 text-zinc-400">Betöltés...</p>}>
            <AdminLoginForm />
        </Suspense>
    );
}

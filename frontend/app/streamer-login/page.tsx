"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function StreamerLoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            await login(email, password);
            window.location.assign("/streamer");
        } catch (err: any) {
            setError(err.message || "Hiba történt a bejelentkezés során.");
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={handleLogin}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-8"
            >
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
                    Streamer fiók
                </p>
                <h1 className="mb-2 text-3xl font-extrabold">Streamer belépés</h1>
                <p className="mb-6 text-sm text-zinc-400">
                    Ezt az ablakot hagyd a streamernek. Nézői teszt: másik ablak vagy privát
                    mód, ott <span className="text-white">nézői regisztráció</span> új emaillel
                    — ne ezzel a fiókkal.
                </p>
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
                        required
                    />
                </label>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                    {busy ? "Belépés..." : "Streamer belépés"}
                </Button>
                <div className="mt-6 grid gap-2 text-sm text-zinc-400">
                    <Link href="/forgot-password?role=streamer" className="hover:text-white">
                        Elfelejtett jelszó?
                    </Link>
                    <Link href="/login" className="hover:text-white">
                        Nézői / admin belépés
                    </Link>
                    <Link href="/streamer-register" className="text-accent hover:underline">
                        Még nincs streamer fiókom
                    </Link>
                </div>
            </form>
        </div>
    );
}

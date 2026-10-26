"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import PasswordField from "@/components/PasswordField";
import { markStreamerLoginIntent } from "@/lib/streamer-login-intent";

export default function StreamerLoginPage() {
    const { login, ready } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        if (!ready || busy) return;
        setError("");
        setBusy(true);
        try {
            const nextUser = await login(email, password);
            if (isAdmin(nextUser) && !nextUser.streamer) {
                router.replace("/admin");
                return;
            }
            if (!isStreamer(nextUser)) {
                setError("Ez nézői fiók. A tartalomkészítő stúdióhoz a tartalomkészítő email címmel lépj be.");
                setBusy(false);
                return;
            }
            markStreamerLoginIntent();
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
                className="w-full max-w-md rounded-2xl bg-card p-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] sm:p-8"
            >
                <Link href="/" className="mb-6 inline-block text-sm text-accent underline">
                    Vissza a LiveShow főoldalra
                </Link>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
                    Tartalomkészítő fiók
                </p>
                <h1 className="mb-2 text-3xl font-extrabold">Tartalomkészítő belépés</h1>
                <p className="mb-6 text-sm text-zinc-400">
                    A stúdióhoz a tartalomkészítőként regisztrált email címet használd.
                </p>
                <label className="mb-4 grid gap-2 text-sm">
                    Email
                    <input
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    Jelszó
                    <PasswordField
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </label>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy || !ready}>
                    {busy || !ready ? "Belépés..." : "Tartalomkészítő belépés"}
                </Button>
                <div className="mt-6 grid gap-2 text-sm text-zinc-400">
                    <Link href="/forgot-password?role=streamer" className="hover:text-white">
                        Elfelejtett jelszó?
                    </Link>
                    <Link href="/login" className="hover:text-white">
                        Nézői / admin belépés
                    </Link>
                    <Link href="/streamer-register" className="text-accent hover:underline">
                        Még nincs tartalomkészítő fiókom
                    </Link>
                </div>
            </form>
        </div>
    );
}

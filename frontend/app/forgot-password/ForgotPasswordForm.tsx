"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/api/http";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordForm() {
    const params = useSearchParams();
    const streamer = params.get("role") === "streamer";
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            await apiFetch("/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email }),
            });
            setDone(true);
        } catch (err: unknown) {
            const message =
                err && typeof err === "object" && "message" in err
                    ? String((err as Error).message)
                    : "A kérés most nem sikerült. Próbáld újra.";
            setError(message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 sm:p-8"
            >
                {streamer && (
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
                        Streamer fiók
                    </p>
                )}
                <h1 className="mb-2 text-3xl font-extrabold">Elfelejtett jelszó</h1>
                <p className="mb-6 text-sm text-zinc-400">
                    Add meg a fiókod e-mail címét. Ha van ilyen fiók, küldünk egy helyreállító
                    linket. A link 30 percig érvényes.
                </p>
                {done ? (
                    <p className="mb-6 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
                        Ha létezik ilyen fiók, küldtünk egy helyreállító e-mailt.
                    </p>
                ) : (
                    <>
                        <label className="mb-6 grid gap-2 text-sm">
                            E-mail
                            <input
                                className="h-11 rounded-xl border border-white/10 bg-black px-3"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>
                        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                        <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                            {busy ? "Küldés..." : "Helyreállító e-mail kérése"}
                        </Button>
                    </>
                )}
                <p className="mt-6 text-sm text-zinc-400">
                    <Link
                        href={streamer ? "/streamer-login" : "/login"}
                        className="text-white underline"
                    >
                        Vissza a belépéshez
                    </Link>
                </p>
            </form>
        </div>
    );
}

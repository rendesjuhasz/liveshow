"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/api/http";
import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function ResetPasswordForm() {
    const params = useSearchParams();
    const token = (params.get("token") || "").trim();
    const { login } = useAuth();
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (password.length < 8) {
            setError("A jelszó legalább 8 karakter legyen.");
            return;
        }
        if (password !== passwordConfirm) {
            setError("A két jelszó nem egyezik.");
            return;
        }
        if (!token) {
            setError("A helyreállító link érvénytelen vagy lejárt.");
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
                    : "A jelszó módosítása nem sikerült.";
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
                <h1 className="mb-2 text-3xl font-extrabold">Új jelszó</h1>
                <p className="mb-6 text-sm text-zinc-400">
                    Add meg az új jelszót kétszer. A helyreállító link csak egyszer, 30 percig
                    használható.
                </p>
                {!token && (
                    <p className="mb-4 text-sm text-red-400">
                        A helyreállító link érvénytelen vagy lejárt.
                    </p>
                )}
                <label className="mb-4 grid gap-2 text-sm">
                    Új jelszó
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
                <label className="mb-6 grid gap-2 text-sm">
                    Jelszó megerősítése
                    <input
                        className="h-11 rounded-xl border border-white/10 bg-black px-3"
                        type="password"
                        autoComplete="new-password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        minLength={8}
                        required
                    />
                </label>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy || !token}>
                    {busy ? "Mentés..." : "Jelszó mentése és belépés"}
                </Button>
                <p className="mt-6 text-sm text-zinc-400">
                    <Link href="/login" className="text-white underline">
                        Vissza a belépéshez
                    </Link>
                </p>
            </form>
        </div>
    );
}

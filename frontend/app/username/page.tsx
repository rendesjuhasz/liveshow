"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import { isAdmin, isStreamer, useAuth, type User } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { needsUsername, USERNAME_RE } from "@/lib/username";
import { useT } from "@/lib/i18n/I18nProvider";

function afterUsernamePath(next: User | null) {
    if (isAdmin(next)) return "/admin";
    if (isStreamer(next)) return "/streamer";
    return "/";
}

export default function ChooseUsernamePage() {
    const { user, ready, acceptSession, logout } = useAuth();
    const router = useRouter();
    const { t } = useT();
    const [username, setUsername] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const hadUser = useRef(false);

    if (user) hadUser.current = true;

    useEffect(() => {
        if (!ready || busy) return;
        if (!user) {
            router.replace("/login");
            return;
        }
        if (!needsUsername(user)) {
            router.replace(afterUsernamePath(user));
        }
    }, [ready, user, busy, router]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        const value = username.trim().toLowerCase();
        if (!USERNAME_RE.test(value)) {
            setError(t("auth.usernameHint"));
            return;
        }
        setBusy(true);
        try {
            const data = await apiFetch("/auth/username", {
                method: "POST",
                body: JSON.stringify({ username: value }),
            });
            const next = acceptSession(data);
            router.replace(afterUsernamePath(next));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t("auth.usernameError"));
        } finally {
            setBusy(false);
        }
    }

    if (!ready) {
        return <p className="p-8 text-white">Betöltés...</p>;
    }

    if (!user) {
        if (hadUser.current) return null;
        return <p className="p-8 text-white">Betöltés...</p>;
    }

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-md rounded-2xl bg-card p-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] sm:p-8"
            >
                <h1 className="mb-2 text-2xl font-extrabold">{t("auth.usernameTitle")}</h1>
                <p className="mb-6 text-sm text-zinc-400">{t("auth.usernameLead")}</p>
                <label className="mb-4 grid gap-2 text-sm">
                    {t("auth.username")}
                    <input
                        className="h-11 rounded-xl bg-[#323232] px-3 text-white"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        autoComplete="username"
                        minLength={3}
                        maxLength={24}
                        required
                    />
                </label>
                <p className="mb-4 text-xs text-zinc-500">{t("auth.usernameHint")}</p>
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                    {busy ? t("auth.busy") : t("auth.usernameSave")}
                </Button>
                <button
                    type="button"
                    className="mt-4 w-full text-sm text-zinc-400 underline"
                    onClick={() => logout()}
                >
                    {t("nav.logout")}
                </button>
            </form>
        </div>
    );
}

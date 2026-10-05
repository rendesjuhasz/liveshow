"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import PasswordField from "@/components/PasswordField";

export default function AdminSecurityPage() {
    const { user, ready, refreshUser } = useAuth();
    const [status, setStatus] = useState<{ enabled?: boolean; required?: boolean } | null>(null);
    const [secret, setSecret] = useState("");
    const [otpauth, setOtpauth] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!ready || !user || !isAdmin(user)) return;
        apiFetch("/auth/2fa/status")
            .then(setStatus)
            .catch(() => setStatus({ enabled: false, required: false }));
    }, [ready, user]);

    if (!ready) return <p className="p-8 text-white">Betöltés...</p>;
    if (!isAdmin(user)) return <p className="p-8 text-white">Nincs admin jogosultság.</p>;

    async function setup() {
        setBusy(true);
        setError("");
        setInfo("");
        try {
            const data = await apiFetch("/auth/2fa/setup", { method: "POST", body: "{}" });
            setSecret(String(data?.secret || ""));
            setOtpauth(String(data?.otpauthUrl || ""));
            setInfo("Olvasd be a titkot egy TOTP appban, majd erősítsd meg a 6 jegyű kóddal. Még nem kötelező.");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "A 2FA indítás sikertelen.");
        }
        setBusy(false);
    }

    async function confirm() {
        setBusy(true);
        setError("");
        try {
            const data = await apiFetch("/auth/2fa/confirm", {
                method: "POST",
                body: JSON.stringify({ code }),
            });
            setStatus(data);
            setSecret("");
            setOtpauth("");
            setCode("");
            setInfo("2FA bekapcsolva ezen a fiókon. A belépésnél még nem kötelező.");
            await refreshUser().catch(() => undefined);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "A megerősítés sikertelen.");
        }
        setBusy(false);
    }

    async function disable() {
        setBusy(true);
        setError("");
        try {
            const data = await apiFetch("/auth/2fa/disable", {
                method: "POST",
                body: JSON.stringify({ password, code }),
            });
            setStatus(data);
            setPassword("");
            setCode("");
            setInfo("2FA kikapcsolva.");
            await refreshUser().catch(() => undefined);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "A kikapcsolás sikertelen.");
        }
        setBusy(false);
    }

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-xl">
                <h1 className="mb-2 text-2xl font-bold">Biztonság</h1>
                <p className="mb-6 text-sm text-zinc-400">
                    TOTP kétlépcsős azonosítás előkészítve. Jelenleg nem kötelező a belépéshez.
                    Állapot: {status?.enabled ? "bekapcsolva" : "ki"}
                    {status?.required ? " · kötelező" : " · opcionális"}
                </p>
                {info && <p className="mb-4 text-sm text-emerald-300">{info}</p>}
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                {!status?.enabled && (
                    <div className="mb-8 space-y-4 rounded-xl bg-gray-800 p-5">
                        <Button type="button" variant="gold" disabled={busy} onClick={() => void setup()}>
                            Titok generálása
                        </Button>
                        {secret && (
                            <p className="break-all font-mono text-sm text-yellow-200">{secret}</p>
                        )}
                        {otpauth && (
                            <p className="break-all text-xs text-zinc-400">{otpauth}</p>
                        )}
                        <label className="grid gap-2 text-sm">
                            Megerősítő kód
                            <input
                                className="h-11 rounded-xl bg-[#323232] px-3"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                inputMode="numeric"
                                maxLength={8}
                            />
                        </label>
                        <Button type="button" disabled={busy || !code} onClick={() => void confirm()}>
                            2FA bekapcsolása
                        </Button>
                    </div>
                )}
                {status?.enabled && (
                    <div className="space-y-4 rounded-xl bg-gray-800 p-5">
                        <label className="grid gap-2 text-sm">
                            Jelszó
                            <PasswordField
                                className="h-11 rounded-xl bg-[#323232] px-3"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </label>
                        <label className="grid gap-2 text-sm">
                            TOTP kód
                            <input
                                className="h-11 rounded-xl bg-[#323232] px-3"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                inputMode="numeric"
                                maxLength={8}
                            />
                        </label>
                        <Button type="button" disabled={busy} onClick={() => void disable()}>
                            2FA kikapcsolása
                        </Button>
                    </div>
                )}
                <a href="/admin" className="mt-8 inline-block text-blue-400">
                    Vissza az adminra
                </a>
            </div>
        </div>
    );
}

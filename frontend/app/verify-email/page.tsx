"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import LocaleLink from "@/components/LocaleLink";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/api/http";
import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";

function VerifyEmailForm() {
    const params = useSearchParams();
    const router = useRouter();
    const token = (params.get("token") || "").trim();
    const { refreshUser, refreshSession, acceptSession } = useAuth();
    const { t } = useT();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const started = useRef(false);

    async function confirm(raw: string) {
        setBusy(true);
        setError("");
        try {
            const data = await apiFetch("/auth/verify-email", {
                method: "POST",
                body: JSON.stringify({ token: raw }),
            });
            acceptSession(data);
            await refreshSession().catch(() => undefined);
            const next = (await refreshUser().catch(() => null)) || data?.user;
            setDone(true);
            const dest = isAdmin(next) ? "/admin" : isStreamer(next) ? "/streamer" : "/";
            router.replace(dest);
        } catch (err: unknown) {
            const message =
                err && typeof err === "object" && "message" in err
                    ? String((err as Error).message)
                    : t("verify.failed");
            setError(message);
            setBusy(false);
        }
    }

    useEffect(() => {
        if (!token || started.current) return;
        started.current = true;
        void confirm(token);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <div className="flex min-h-[80dvh] items-center justify-center px-4 py-10 sm:py-16">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 sm:p-8">
                <h1 className="mb-2 text-3xl font-extrabold">{t("verify.title")}</h1>
                <p className="mb-6 text-sm text-zinc-400">{t("verify.lead")}</p>
                {!token && <p className="mb-4 text-sm text-red-400">{t("verify.missing")}</p>}
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                {done && <p className="mb-4 text-sm text-emerald-400">{t("verify.done")}</p>}
                {token && !done && (
                    <Button type="button" variant="gold" className="w-full" disabled={busy} onClick={() => confirm(token)}>
                        {busy ? t("verify.busy") : t("verify.cta")}
                    </Button>
                )}
                <p className="mt-6 text-sm text-zinc-400">
                    <LocaleLink href="/" className="underline">
                        {t("verify.home")}
                    </LocaleLink>
                </p>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<p className="p-8 text-zinc-400">…</p>}>
            <VerifyEmailForm />
        </Suspense>
    );
}

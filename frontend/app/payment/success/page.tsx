"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import { useT } from "@/lib/i18n/I18nProvider";
import LocaleLink from "@/components/LocaleLink";

function PaymentSuccessInner() {
    const params = useSearchParams();
    const router = useRouter();
    const { t } = useT();
    const paymentId = params.get("paymentId") || params.get("PaymentId");
    const sessionId = params.get("session_id");
    const [phase, setPhase] = useState<"wait" | "ok" | "err">(
        paymentId || sessionId ? "wait" : "err",
    );
    const [error, setError] = useState(
        paymentId || sessionId ? "" : "Hiányzik a fizetés azonosítója. A visszatérő cím önmagában nem igazolja a fizetést.",
    );

    useEffect(() => {
        let cancelled = false;
        let tries = 0;

        async function check() {
            tries += 1;
            try {
                if (sessionId) {
                    await apiFetch("/payments/confirm-stripe", {
                        method: "POST",
                        body: JSON.stringify({ sessionId }),
                    });
                    if (!cancelled) setPhase("ok");
                    return;
                }
                if (paymentId) {
                    const data = await apiFetch(
                        `/payments/barion/status?paymentId=${encodeURIComponent(paymentId)}`,
                    );
                    if (data?.paid || data?.streamAccess === "STREAM_ACCESS_GRANTED") {
                        if (!cancelled) setPhase("ok");
                        return;
                    }
                    if (data?.paymentStatus === "failed" || data?.paymentStatus === "cancelled") {
                        router.replace("/payment/failed");
                        return;
                    }
                }
            } catch (err: any) {
                if (tries >= 8) {
                    if (!cancelled) {
                        setError(err.message || "A fizetés ellenőrzése sikertelen.");
                        setPhase("err");
                    }
                    return;
                }
            }
            if (tries < 8 && (paymentId || sessionId)) {
                setTimeout(check, 1500);
            } else if (!cancelled && (paymentId || sessionId)) {
                setError("A fizetés még feldolgozás alatt. Frissítsd az oldalt néhány másodperc múlva.");
                setPhase("err");
            }
        }

        if (paymentId || sessionId) {
            check();
        }
        return () => {
            cancelled = true;
        };
    }, [paymentId, sessionId, router]);

    return (
        <div className="min-h-dvh bg-neutral-950 px-4 py-10 text-white sm:py-16">
            <div className="mx-auto max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-8">
                {phase === "wait" && (
                    <>
                        <h1 className="text-2xl font-bold mb-4">{t("payment.processing")}</h1>
                        <p className="text-neutral-300">{t("payment.wait")}</p>
                    </>
                )}
                {phase === "ok" && (
                    <>
                        <h1 className="text-2xl font-bold mb-4">{t("payment.thanks")}</h1>
                        <p className="text-neutral-200 mb-6">{t("payment.okBody")}</p>
                    </>
                )}
                {phase === "err" && (
                    <>
                        <h1 className="text-2xl font-bold mb-4">Fizetés</h1>
                        <p className="text-red-400 mb-6">{error}</p>
                    </>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                    <LocaleLink href="/profile" className="text-yellow-400 underline">
                        {t("payment.myTickets")}
                    </LocaleLink>
                    <LocaleLink href="/shows" className="text-neutral-400 underline">
                        {t("nav.events")}
                    </LocaleLink>
                </div>
            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-dvh bg-neutral-950 p-4 text-white sm:p-8">
                    <h1 className="text-2xl font-bold mb-4">Fizetés feldolgozása...</h1>
                    <p>Kérjük, várjon.</p>
                </div>
            }
        >
            <PaymentSuccessInner />
        </Suspense>
    );
}

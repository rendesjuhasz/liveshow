"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import LocaleLink from "@/components/LocaleLink";
import { useT } from "@/lib/i18n/I18nProvider";
import { apiFetch } from "@/api/http";

function PaymentFailedInner() {
    const { t } = useT();
    const params = useSearchParams();
    const sessionId = params.get("session_id");

    useEffect(() => {
        if (!sessionId) return;
        apiFetch("/payments/cancel", {
            method: "POST",
            body: JSON.stringify({ sessionId }),
        }).catch(() => undefined);
    }, [sessionId]);

    return (
        <div className="min-h-dvh bg-neutral-950 px-4 py-10 text-white sm:py-16">
            <div className="mx-auto max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-8">
                <h1 className="text-2xl font-bold mb-4">{t("payment.failed")}</h1>
                <p className="text-neutral-300 mb-6">{t("payment.retry")}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <LocaleLink href="/shows" className="text-yellow-400 underline">
                        {t("payment.back")}
                    </LocaleLink>
                    <LocaleLink href="/profile" className="text-neutral-400 underline">
                        {t("payment.myTickets")}
                    </LocaleLink>
                </div>
            </div>
        </div>
    );
}

export default function PaymentFailedPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-dvh bg-neutral-950 p-4 text-white sm:p-8">
                    <h1 className="text-2xl font-bold mb-4">Fizetés</h1>
                    <p>Betöltés...</p>
                </div>
            }
        >
            <PaymentFailedInner />
        </Suspense>
    );
}

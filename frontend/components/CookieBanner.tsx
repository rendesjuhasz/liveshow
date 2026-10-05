"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    COOKIE_CONSENT_VALUES,
    readCookieConsent,
    writeCookieConsent,
    type CookieConsentValue,
} from "@/lib/cookie-consent";
import { useT } from "@/lib/i18n/I18nProvider";

export default function CookieBanner() {
    const { t } = useT();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setOpen(!readCookieConsent());
    }, []);

    function choose(value: CookieConsentValue) {
        try {
            writeCookieConsent(value);
        } catch {
            /* private mode / blocked storage */
        }
        setOpen(false);
    }

    if (!open) return null;

    return (
        <div
            data-cookie-banner=""
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cookie-banner-title"
            aria-describedby="cookie-banner-text"
        >
            <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl bg-card p-4 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)] sm:p-5">
                <h2 id="cookie-banner-title" className="text-lg font-semibold mb-2">
                    {t("cookie.title")}
                </h2>
                <p id="cookie-banner-text" className="text-sm text-neutral-300 leading-relaxed mb-4">
                    {t("cookie.body")}{" "}
                    <Link href="/cookie-tajekoztato" className="text-accent underline">
                        {t("legal.cookies")}
                    </Link>
                    {", "}
                    <Link href="/adatkezeles" className="text-accent underline">
                        {t("legal.privacy")}
                    </Link>
                    .
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                    <button
                        type="button"
                        data-cookie-choice="rejected"
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-600 text-neutral-200 hover:bg-neutral-800"
                        onClick={() => choose(COOKIE_CONSENT_VALUES.rejected)}
                    >
                        {t("cookie.reject")}
                    </button>
                    <button
                        type="button"
                        data-cookie-choice="accepted"
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-[#0b1220] font-bold hover:bg-accent"
                        onClick={() => choose(COOKIE_CONSENT_VALUES.accepted)}
                    >
                        {t("cookie.accept")}
                    </button>
                </div>
            </div>
        </div>
    );
}

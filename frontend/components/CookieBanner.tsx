"use client";

import Link from "next/link";
import {
    COOKIE_CONSENT_VALUES,
    writeCookieConsent,
    type CookieConsentValue,
} from "@/lib/cookie-consent";

function hideBanner() {
    document.documentElement.setAttribute("data-cookie-consent", "1");
}

export default function CookieBanner() {
    function choose(value: CookieConsentValue) {
        try {
            writeCookieConsent(value);
        } catch {
            /* private mode / blocked storage */
        }
        hideBanner();
    }

    return (
        <div
            data-cookie-banner=""
            className="cookie-banner pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cookie-banner-title"
            aria-describedby="cookie-banner-text"
        >
            <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-neutral-700 bg-neutral-900 text-white shadow-2xl p-4 sm:p-5">
                <h2 id="cookie-banner-title" className="text-lg font-semibold mb-2">
                    Sütik használata
                </h2>
                <p id="cookie-banner-text" className="text-sm text-neutral-300 leading-relaxed mb-4">
                    A LiveShow a bejelentkezéshez és a működéshez szükséges sütiket, valamint a
                    hozzájárulásod rögzítését használja. Opcionális (például statisztikai)
                    sütiket csak elfogadás után indítunk. Részletek:{" "}
                    <Link href="/cookie-tajekoztato" className="text-yellow-400 underline">
                        Cookie tájékoztató
                    </Link>{" "}
                    és{" "}
                    <Link href="/adatkezeles" className="text-yellow-400 underline">
                        Adatkezelési tájékoztató
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
                        Elutasítom
                    </button>
                    <button
                        type="button"
                        data-cookie-choice="accepted"
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400"
                        onClick={() => choose(COOKIE_CONSENT_VALUES.accepted)}
                    >
                        Elfogadom
                    </button>
                </div>
            </div>
        </div>
    );
}

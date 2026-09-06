"use client";

import { useLayoutEffect, useState } from "react";
import {
    COOKIE_CONSENT_EVENT,
    COOKIE_CONSENT_VALUES,
    clearCookieConsent,
    readCookieConsent,
    writeCookieConsent,
    type CookieConsentValue,
} from "@/lib/cookie-consent";

const LABELS: Record<CookieConsentValue, string> = {
    accepted: "elfogadva",
    rejected: "elutasítva",
};

export default function CookieConsentControls() {
    const [value, setValue] = useState<CookieConsentValue | null>(null);
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
        const sync = () => {
            setValue(readCookieConsent());
            setReady(true);
        };
        sync();
        window.addEventListener(COOKIE_CONSENT_EVENT, sync);
        return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
    }, []);

    function choose(next: CookieConsentValue) {
        try {
            writeCookieConsent(next);
            setValue(next);
        } catch {
            setValue(next);
        }
    }

    if (!ready) {
        return null;
    }

    return (
        <div className="mt-8 p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
            <p className="text-sm text-neutral-400 mb-3">
                Jelenlegi választás:{" "}
                <strong className="text-white">{value ? LABELS[value] : "még nincs döntés"}</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <button
                    type="button"
                    data-cookie-choice="accepted"
                    className="px-4 py-2 rounded-xl bg-yellow-500 text-black font-bold"
                    onClick={() => choose(COOKIE_CONSENT_VALUES.accepted)}
                >
                    Elfogadom
                </button>
                <button
                    type="button"
                    data-cookie-choice="rejected"
                    className="px-4 py-2 rounded-xl border border-neutral-600"
                    onClick={() => choose(COOKIE_CONSENT_VALUES.rejected)}
                >
                    Elutasítom
                </button>
                <button
                    type="button"
                    className="px-4 py-2 rounded-xl border border-neutral-600"
                    onClick={() => {
                        try {
                            clearCookieConsent();
                        } catch {
                            setValue(null);
                        }
                    }}
                >
                    Döntés törlése
                </button>
            </div>
        </div>
    );
}

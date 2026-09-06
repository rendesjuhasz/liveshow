export const COOKIE_CONSENT_KEY = "cookieConsent";
export const COOKIE_CONSENT_EVENT = "liveshow-cookie-consent";

export const COOKIE_CONSENT_VALUES = {
    accepted: "accepted",
    rejected: "rejected",
} as const;

export type CookieConsentValue =
    (typeof COOKIE_CONSENT_VALUES)[keyof typeof COOKIE_CONSENT_VALUES];

function notifyConsentChange() {
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

export function readCookieConsent(): CookieConsentValue | null {
    try {
        const value = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (
            value === COOKIE_CONSENT_VALUES.accepted ||
            value === COOKIE_CONSENT_VALUES.rejected
        ) {
            return value;
        }
    } catch {
        return null;
    }
    return null;
}

export function writeCookieConsent(value: CookieConsentValue) {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    document.documentElement.setAttribute("data-cookie-consent", value);
    notifyConsentChange();
}

export function clearCookieConsent() {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    document.documentElement.removeAttribute("data-cookie-consent");
    notifyConsentChange();
}

const reported = new Set<string>();

function apiBase() {
    if (typeof window !== "undefined") return "/api";
    return (
        (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.trim()) ||
        "http://127.0.0.1:3200"
    );
}

/** Once per key+locale per session. Dev: console.warn. Prod: POST /i18n/missing. Failures stay silent. */
export function reportMissingTranslation(key: string, locale: string) {
    const id = `${locale}:${key}`;
    if (reported.has(id)) return;
    reported.add(id);
    if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] missing key: ${key} (${locale})`);
        return;
    }
    if (typeof window === "undefined") return;
    try {
        const csrf =
            document.cookie
                .split("; ")
                .find((part) => part.startsWith("ls_csrf="))
                ?.slice("ls_csrf=".length) || "";
        void fetch(`${apiBase()}/i18n/missing`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
            },
            body: JSON.stringify({ key, locale }),
        }).catch(() => undefined);
    } catch {
        /* ignore */
    }
}

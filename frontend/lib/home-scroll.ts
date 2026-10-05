const KEY = "liveshow_home_scroll";

export type HomeScrollSnap = {
    y: number;
    rows: number[];
};

function isHomePath(pathname: string) {
    const path = pathname.replace(/^\/(en|de|it|es|fr)(?=\/|$)/, "") || "/";
    return path === "/";
}

export function saveHomeScroll(pathname?: string) {
    if (typeof window === "undefined") return;
    if (pathname && !isHomePath(pathname)) return;
    if (!pathname && !isHomePath(window.location.pathname)) return;
    const rows = [...document.querySelectorAll<HTMLElement>("[data-home-row]")].map(
        (el) => el.scrollLeft,
    );
    const snap: HomeScrollSnap = { y: Math.max(0, Math.round(window.scrollY)), rows };
    try {
        sessionStorage.setItem(KEY, JSON.stringify(snap));
    } catch {
        /* ignore */
    }
}

export function readHomeScroll(): HomeScrollSnap | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as HomeScrollSnap;
        if (!parsed || typeof parsed.y !== "number") return null;
        return { y: parsed.y, rows: Array.isArray(parsed.rows) ? parsed.rows : [] };
    } catch {
        return null;
    }
}

export function applyHomeScroll(snap: HomeScrollSnap | null) {
    if (!snap || typeof window === "undefined") return;
    window.scrollTo(0, snap.y);
    const rows = document.querySelectorAll<HTMLElement>("[data-home-row]");
    rows.forEach((el, i) => {
        const left = snap.rows[i];
        if (typeof left === "number") el.scrollLeft = left;
    });
}

export function homeScrollReservePx(snap: HomeScrollSnap | null) {
    if (!snap || typeof window === "undefined" || snap.y < 8) return 0;
    return Math.round(snap.y + window.innerHeight);
}

export function isHomePathname(pathname = typeof window === "undefined" ? "" : window.location.pathname) {
    return isHomePath(pathname);
}

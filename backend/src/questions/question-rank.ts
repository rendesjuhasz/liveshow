const STOP = new Set([
    "a", "az", "egy", "es", "és", "hogy", "de", "is", "ha", "mint", "vagy",
    "mi", "mit", "miert", "miért", "hogyan", "mikor", "hol", "ki", "kit",
    "van", "volt", "lesz", "lenne", "kell", "lehet", "szeretnek", "szeretném",
    "kerdezni", "kérdezni", "kerdes", "kérdés", "stream", "streamer", "elo", "élő",
    "adas", "adás", "pls", "kerlek", "kérlek", "koszi", "köszi",
]);

export function foldHu(text: string) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function contentTokens(text: string) {
    return foldHu(text)
        .split(" ")
        .map((w) => w.replace(/(nal|nel|tol|től|bol|ből|nak|nek|ban|ben|val|vel|hoz|hez|hoz)$/u, ""))
        .filter((w) => w.length >= 3 && !STOP.has(w));
}

function jaccard(a: string[], b: string[]) {
    const A = new Set(a);
    const B = new Set(b);
    let inter = 0;
    for (const x of A) if (B.has(x)) inter += 1;
    const union = A.size + B.size - inter;
    return union ? inter / union : 0;
}

export function questionsSimilar(a: string, b: string) {
    const fa = foldHu(a);
    const fb = foldHu(b);
    if (!fa || !fb) return false;
    if (fa === fb) return true;
    if (fa.includes(fb) || fb.includes(fa)) {
        const shorter = fa.length < fb.length ? fa : fb;
        if (shorter.length >= 12) return true;
    }
    const ta = contentTokens(a);
    const tb = contentTokens(b);
    if (ta.length === 0 || tb.length === 0) return false;
    const jac = jaccard(ta, tb);
    if (jac >= 0.42) return true;
    const shared = ta.filter((t) => tb.includes(t));
    return shared.length >= 2 && shared.length / Math.min(ta.length, tb.length) >= 0.5;
}

export function topicKeyFromText(text: string) {
    const tokens = [...new Set(contentTokens(text))].sort().slice(0, 6);
    const base = tokens.join("|") || foldHu(text).slice(0, 40);
    let h = 0;
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
    return `t${Math.abs(h).toString(16)}`;
}

export function viewerStatus(status?: string | null) {
    const value = String(status || "").toLowerCase();
    if (value === "fulfilled" || value === "completed" || value === "answered") return "fulfilled";
    if (value === "rejected") return "rejected";
    return "pending";
}

export function viewerStatusLabelHu(status?: string | null) {
    const v = viewerStatus(status);
    if (v === "fulfilled") return "Teljesült";
    if (v === "rejected") return "Elutasítva";
    return "Függőben";
}

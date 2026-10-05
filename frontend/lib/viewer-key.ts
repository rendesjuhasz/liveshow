const VIEWER_KEY = "liveshow_viewer";
const KEY_RE = /^[a-zA-Z0-9_-]{8,64}$/;

let memoryKey = "";

function newViewerKey() {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

export function getViewerKey() {
    if (typeof window === "undefined") return memoryKey || (memoryKey = newViewerKey());
    try {
        let value = window.sessionStorage.getItem(VIEWER_KEY);
        if (!value || !KEY_RE.test(value)) {
            value = newViewerKey();
            window.sessionStorage.setItem(VIEWER_KEY, value);
        }
        memoryKey = value;
        return value;
    } catch {
        if (!memoryKey || !KEY_RE.test(memoryKey)) memoryKey = newViewerKey();
        return memoryKey;
    }
}

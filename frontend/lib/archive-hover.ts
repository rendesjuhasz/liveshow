export const PREVIEW_HOVER_MS = 1000;
export const PREVIEW_CLIP_SEC = 12;

let activeStop: (() => void) | null = null;

export function canHoverPreview() {
    if (typeof window === "undefined") return false;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return false;
    if (window.matchMedia("(max-width: 767px)").matches) return false;
    return true;
}

export function claimPreviewSlot(stop: () => void) {
    if (activeStop && activeStop !== stop) activeStop();
    activeStop = stop;
}

export function releasePreviewSlot(stop: () => void) {
    if (activeStop === stop) activeStop = null;
}

export function previewStartFraction(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return 0.2 + (Math.abs(h) % 11) / 100;
}

export function previewMediaSrc(pathWithQuery: string) {
    if (pathWithQuery.startsWith("http")) return pathWithQuery;
    return pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
}

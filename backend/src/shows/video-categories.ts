export const VIDEO_CATEGORIES = [
    { value: "turisztika", label: "Turisztika" },
    { value: "oktatas", label: "Oktatás" },
    { value: "uzleti", label: "Üzleti" },
    { value: "tanacsadas", label: "Tanácsadás" },
    { value: "kereskedelem", label: "Kereskedelem" },
    { value: "podcast", label: "Podcast / Interjú" },
    { value: "gaming", label: "Gaming" },
    { value: "egyeb", label: "Egyéb" },
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number]["value"];

export function isVideoCategory(value: string): value is VideoCategory {
    return VIDEO_CATEGORIES.some((item) => item.value === value);
}

export function videoCategoryLabel(value?: string | null) {
    return VIDEO_CATEGORIES.find((item) => item.value === value)?.label || "Egyéb";
}

export function normalizeVideoCategory(value?: string | null): VideoCategory {
    const next = String(value || "").trim().toLowerCase();
    return isVideoCategory(next) ? next : "egyeb";
}

export function videoCategoryFields(value?: string | null) {
    const videoCategory = normalizeVideoCategory(value);
    return {
        videoCategory,
        videoCategoryLabel: videoCategoryLabel(videoCategory),
    };
}

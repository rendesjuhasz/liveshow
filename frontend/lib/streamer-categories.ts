export const STREAMER_CATEGORIES = [
    { value: "zene", label: "Zene" },
    { value: "talkshow", label: "Talkshow" },
    { value: "sport", label: "Sport" },
    { value: "oktatas", label: "Oktatás" },
    { value: "humor", label: "Humor" },
    { value: "gaming", label: "Gaming" },
    { value: "muveszet", label: "Művészet" },
    { value: "egyeb", label: "Egyéb" },
] as const;

export function streamerCategoryLabel(value?: string | null) {
    return STREAMER_CATEGORIES.find((c) => c.value === value)?.label || value || "—";
}

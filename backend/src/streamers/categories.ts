export const STREAMER_CATEGORIES = [
    "zene",
    "talkshow",
    "sport",
    "oktatas",
    "humor",
    "gaming",
    "muveszet",
    "egyeb",
] as const;

export type StreamerCategory = (typeof STREAMER_CATEGORIES)[number];

export function isStreamerCategory(value: string): value is StreamerCategory {
    return (STREAMER_CATEGORIES as readonly string[]).includes(value);
}

export const REACTION_EMOJIS = ["❤️", "🔥", "😂", "👏", "👍", "😮", "😢", "😡"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
export type ReactionKey = "heart" | "fire" | "laugh" | "clap" | "like" | "wow" | "sad" | "angry";

export const REACTION_STATS_ORDER: { key: ReactionKey; emoji: ReactionEmoji }[] = [
    { key: "heart", emoji: "❤️" },
    { key: "fire", emoji: "🔥" },
    { key: "clap", emoji: "👏" },
    { key: "laugh", emoji: "😂" },
    { key: "like", emoji: "👍" },
    { key: "wow", emoji: "😮" },
    { key: "sad", emoji: "😢" },
    { key: "angry", emoji: "😡" },
];

export type ReactionCounts = Record<string, number>;

export function emptyReactionCounts(): ReactionCounts {
    return { heart: 0, fire: 0, laugh: 0, clap: 0, like: 0, wow: 0, sad: 0, angry: 0 };
}

export function mergeReactionCounts(raw?: Partial<ReactionCounts> | null): ReactionCounts {
    const next = emptyReactionCounts();
    for (const [key, value] of Object.entries(raw || {})) {
        if (typeof value === "number" && Number.isFinite(value)) next[key] = value;
    }
    return next;
}

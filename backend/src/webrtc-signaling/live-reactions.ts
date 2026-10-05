export const REACTION_EMOJIS = ["❤️", "🔥", "😂", "👏", "👍", "😮", "😢", "😡"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
export type ReactionKey = "heart" | "fire" | "laugh" | "clap" | "like" | "wow" | "sad" | "angry";

export const EMPTY_REACTION_COUNTS: Record<ReactionKey, number> = {
    heart: 0,
    fire: 0,
    laugh: 0,
    clap: 0,
    like: 0,
    wow: 0,
    sad: 0,
    angry: 0,
};

const EMOJI_TO_KEY: Record<string, ReactionKey> = {
    "❤️": "heart",
    "❤": "heart",
    "♥": "heart",
    "🔥": "fire",
    "😂": "laugh",
    "👏": "clap",
    "👍": "like",
    "😮": "wow",
    "😢": "sad",
    "😡": "angry",
};

export function reactionKeyOf(emoji: string): ReactionKey | "" {
    return EMOJI_TO_KEY[String(emoji || "").trim()] || "";
}

export function emptyReactionCounts(): Record<string, number> {
    return { ...EMPTY_REACTION_COUNTS };
}

export type IncomingReaction = {
    type?: string;
    reactionType?: string;
    value?: string;
    emoji?: string;
    streamId?: string;
    showId?: string;
};

export function parseReactionPayload(payload: IncomingReaction) {
    const reactionType = String(payload?.reactionType || "emoji").trim().slice(0, 32) || "emoji";
    const value = String(payload?.value || payload?.emoji || "").trim().slice(0, 64);
    const showId = String(payload?.showId || "").trim();
    const emojiKey = reactionType === "emoji" ? reactionKeyOf(value) : "";
    const countKey =
        reactionType === "emoji" ? emojiKey : value ? `${reactionType}:${value}` : "";
    return {
        reactionType,
        value,
        countKey,
        animate: reactionType === "emoji" && Boolean(emojiKey),
        showId,
    };
}

type RateBucket = { last: number; window: number[] };

export class LiveReactionStore {
    private counts = new Map<string, Record<string, number>>();
    private rates = new Map<string, RateBucket>();
    private animTimes = new Map<string, number[]>();
    private snapshots = new Map<string, number>();
    private static readonly MAX_ANIM_PER_SEC = 30;
    private static readonly MAX_ANIM_PER_100MS = 5;

    reset(showId: string) {
        const id = String(showId || "").trim();
        if (!id) return;
        this.counts.set(id, emptyReactionCounts());
        this.animTimes.delete(id);
        this.snapshots.delete(id);
        for (const key of [...this.rates.keys()]) {
            if (key.startsWith(`${id}:`)) this.rates.delete(key);
        }
    }

    clear(showId: string) {
        const id = String(showId || "").trim();
        this.counts.delete(id);
        this.animTimes.delete(id);
        this.snapshots.delete(id);
        for (const key of [...this.rates.keys()]) {
            if (key.startsWith(`${id}:`)) this.rates.delete(key);
        }
    }

    snapshot(showId: string) {
        return { ...(this.counts.get(showId) || emptyReactionCounts()) };
    }

    allowRate(viewerKey: string, now = Date.now()) {
        const key = String(viewerKey || "").trim();
        if (!key) return false;
        const bucket = this.rates.get(key) || { last: 0, window: [] };
        if (now - bucket.last < 1000) return false;
        const window = bucket.window.filter((t) => now - t < 10_000);
        if (window.length >= 5) return false;
        window.push(now);
        this.rates.set(key, { last: now, window });
        return true;
    }

    add(showId: string, key: string) {
        if (!key) return this.snapshot(showId);
        const row = this.counts.get(showId) || emptyReactionCounts();
        row[key] = (row[key] || 0) + 1;
        this.counts.set(showId, row);
        return { ...row };
    }

    shouldAnimate(showId: string, now = Date.now()) {
        const recent = (this.animTimes.get(showId) || []).filter((t) => now - t < 1000);
        const last100 = recent.filter((t) => now - t < 100);
        if (last100.length >= LiveReactionStore.MAX_ANIM_PER_100MS || recent.length >= LiveReactionStore.MAX_ANIM_PER_SEC) {
            this.animTimes.set(showId, recent);
            return false;
        }
        recent.push(now);
        this.animTimes.set(showId, recent);
        return true;
    }

    shouldSnapshot(showId: string, now = Date.now()) {
        const last = this.snapshots.get(showId) || 0;
        if (now - last < 250) return false;
        this.snapshots.set(showId, now);
        return true;
    }
}

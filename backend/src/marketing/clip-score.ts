export const CLIP_LENGTHS = [15, 30, 60, 90, 120] as const;
export type ClipLength = (typeof CLIP_LENGTHS)[number];

export function normalizeClipLength(value: unknown): ClipLength {
    const n = Number(value);
    return (CLIP_LENGTHS as readonly number[]).includes(n) ? (n as ClipLength) : 30;
}

export type ActivitySample = {
    viewers: number;
    chat: number;
    questions: number;
    support: number;
};

export function spikeScore(now: ActivitySample, avg: ActivitySample) {
    const parts = [
        { key: "viewer_spike" as const, n: now.viewers, a: avg.viewers, w: 3, min: 2 },
        { key: "chat_spike" as const, n: now.chat, a: avg.chat, w: 2, min: 4 },
        { key: "question_spike" as const, n: now.questions, a: avg.questions, w: 2.5, min: 2 },
        { key: "reaction_spike" as const, n: now.support, a: avg.support, w: 2, min: 2 },
    ];
    let best = { reason: "activity_peak", score: 0 };
    for (const p of parts) {
        const baseline = Math.max(p.a, 0.5);
        const ratio = p.n / baseline;
        if (p.n < p.min || ratio < 1.6) continue;
        const score = (ratio - 1) * p.w * Math.log2(1 + p.n);
        if (score > best.score) best = { reason: p.key, score };
    }
    const total = now.viewers + now.chat + now.questions * 2 + now.support;
    if (total >= 8 && total > best.score) {
        best = { reason: "activity_peak", score: total };
    }
    return best;
}

export function rankTopClips<T extends { score: number; createdAt: Date | string }>(
    rows: T[],
    take = 5,
): Array<T & { rank: number }> {
    return [...rows]
        .sort((a, b) => b.score - a.score || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, take)
        .map((row, i) => Object.assign({}, row, { rank: i + 1 }));
}

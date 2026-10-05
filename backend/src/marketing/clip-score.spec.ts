import { rankTopClips, spikeScore } from "./clip-score";

describe("marketing clip scoring", () => {
    it("detects viewer and chat spikes", () => {
        const avg = { viewers: 4, chat: 3, questions: 0, support: 0 };
        const now = { viewers: 18, chat: 12, questions: 3, support: 4 };
        const spike = spikeScore(now, avg);
        expect(spike.score).toBeGreaterThan(1.2);
        expect(["viewer_spike", "chat_spike", "question_spike", "reaction_spike", "activity_peak"]).toContain(
            spike.reason,
        );
    });

    it("ranks top 5 by score", () => {
        const rows = [1, 9, 3, 8, 2, 7, 4].map((score, i) => ({
            score,
            createdAt: new Date(i * 1000),
        }));
        const top = rankTopClips(rows, 5);
        expect(top.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
        expect(top[0].score).toBe(9);
    });
});

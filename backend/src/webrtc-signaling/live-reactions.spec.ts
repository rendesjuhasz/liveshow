import { emptyReactionCounts, LiveReactionStore, parseReactionPayload, reactionKeyOf } from "./live-reactions";

describe("live reactions", () => {
    it("maps supported emojis", () => {
        expect(reactionKeyOf("❤️")).toBe("heart");
        expect(reactionKeyOf("👍")).toBe("like");
        expect(reactionKeyOf("✨")).toBe("");
    });

    it("parses extensible payload", () => {
        expect(
            parseReactionPayload({ type: "reaction", reactionType: "emoji", value: "🔥", showId: "s1" }),
        ).toEqual({
            reactionType: "emoji",
            value: "🔥",
            countKey: "fire",
            animate: true,
            showId: "s1",
        });
        expect(parseReactionPayload({ emoji: "❤️" }).countKey).toBe("heart");
        expect(parseReactionPayload({ reactionType: "sticker", value: "star" })).toMatchObject({
            countKey: "sticker:star",
            animate: false,
        });
        expect(parseReactionPayload({ emoji: "nope" }).animate).toBe(false);
    });

    it("counts every reaction and samples animations", () => {
        const store = new LiveReactionStore();
        store.reset("show");
        let animated = 0;
        for (let i = 0; i < 80; i += 1) {
            store.add("show", "heart");
            if (store.shouldAnimate("show", 1_000 + i)) animated += 1;
        }
        expect(store.snapshot("show").heart).toBe(80);
        expect(animated).toBeLessThanOrEqual(30);
        expect(animated).toBeGreaterThan(0);
        expect(emptyReactionCounts().heart).toBe(0);
    });

    it("caps 5 animations per 100ms", () => {
        const store = new LiveReactionStore();
        let n = 0;
        for (let i = 0; i < 20; i += 1) {
            if (store.shouldAnimate("show", 5000)) n += 1;
        }
        expect(n).toBe(5);
    });

    it("clears counters for a new stream", () => {
        const store = new LiveReactionStore();
        store.add("show", "heart");
        store.reset("show");
        expect(store.snapshot("show").heart).toBe(0);
        store.add("show", "fire");
        store.clear("show");
        expect(store.snapshot("show").heart).toBe(0);
        expect(store.snapshot("show").fire).toBe(0);
    });

    it("enforces 1/s and 5/10s", () => {
        const store = new LiveReactionStore();
        expect(store.allowRate("v", 1000)).toBe(true);
        expect(store.allowRate("v", 1500)).toBe(false);
        expect(store.allowRate("v", 2100)).toBe(true);
        expect(store.allowRate("v", 3200)).toBe(true);
        expect(store.allowRate("v", 4300)).toBe(true);
        expect(store.allowRate("v", 5400)).toBe(true);
        expect(store.allowRate("v", 6500)).toBe(false);
        expect(store.allowRate("v", 12_200)).toBe(true);
    });
});

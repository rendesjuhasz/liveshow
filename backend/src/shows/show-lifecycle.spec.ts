import {
    SHOW_MISS_AFTER_MS,
    hasEverGoneLive,
    isEndedByFields,
    shouldPersistMissed,
    showAudiencePhase,
} from "./show-lifecycle";

const start = Date.parse("2026-10-03T16:00:00.000Z"); // 18:00 Europe/Budapest

describe("show lifecycle after startTime", () => {
    const base = {
        id: "show-1",
        live: false,
        status: "active" as const,
        startTime: "2026-10-03T16:00:00.000Z",
        wentLiveAt: null as string | null,
    };

    it("stays delayed and not archived 10 minutes after start if never live", () => {
        const now = start + 10 * 60 * 1000;
        expect(showAudiencePhase(base, now)).toBe("delayed");
        expect(isEndedByFields(base, now)).toBe(false);
        expect(shouldPersistMissed(base, now)).toBe(false);
    });

    it("stays delayed and startable 90 minutes after start if never live", () => {
        const now = start + 90 * 60 * 1000;
        expect(showAudiencePhase(base, now)).toBe("delayed");
        expect(isEndedByFields(base, now)).toBe(false);
        expect(hasEverGoneLive(base)).toBe(false);
    });

    it("becomes missed 2.5 hours after start if never live, without archiving", () => {
        const now = start + 150 * 60 * 1000;
        expect(showAudiencePhase(base, now)).toBe("missed");
        expect(isEndedByFields(base, now)).toBe(false);
        expect(shouldPersistMissed(base, now)).toBe(true);
    });

    it("is archived/ended only after a real live start then stop", () => {
        const goneLive = {
            ...base,
            wentLiveAt: "2026-10-03T16:10:00.000Z",
            live: false,
            status: "archived",
        };
        const now = Date.parse("2026-10-03T17:00:00.000Z");
        expect(hasEverGoneLive(goneLive)).toBe(true);
        expect(showAudiencePhase(goneLive, now)).toBe("ended");
        expect(isEndedByFields(goneLive, now)).toBe(true);
        expect(shouldPersistMissed(goneLive, now)).toBe(false);
    });

    it("does not treat startTime alone as ended", () => {
        expect(isEndedByFields(base, start + 60_000)).toBe(false);
    });

    it("keeps a live show from ending even after startTime", () => {
        expect(showAudiencePhase({ ...base, live: true }, start + SHOW_MISS_AFTER_MS * 2)).toBe("live");
        expect(isEndedByFields({ ...base, live: true }, start + SHOW_MISS_AFTER_MS * 2)).toBe(false);
    });
});

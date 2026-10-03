import { isEndedByFields } from "./show-ended";

const now = Date.parse("2026-09-13T21:20:00.000Z");

describe("isEndedByFields", () => {
    it("does not end an unpublished-live show just because startTime passed", () => {
        expect(
            isEndedByFields(
                {
                    id: "beka",
                    live: false,
                    status: "active",
                    startTime: "2026-09-13T21:00:00.000Z",
                    endTime: "2026-09-13T23:15:00.000Z",
                },
                now,
            ),
        ).toBe(false);
    });

    it("does not archive from endTime if the stream never started", () => {
        expect(
            isEndedByFields(
                {
                    id: "beka",
                    live: false,
                    status: "active",
                    startTime: "2026-09-13T21:00:00.000Z",
                    endTime: "2026-09-13T21:10:00.000Z",
                },
                now,
            ),
        ).toBe(false);
    });

    it("marks ended after a real live session", () => {
        expect(
            isEndedByFields(
                {
                    id: "beka",
                    live: false,
                    status: "archived",
                    startTime: "2026-09-13T21:00:00.000Z",
                    wentLiveAt: "2026-09-13T21:05:00.000Z",
                },
                now,
            ),
        ).toBe(true);
    });

    it("does not treat a live show as ended", () => {
        expect(
            isEndedByFields(
                {
                    id: "beka",
                    live: true,
                    status: "active",
                    startTime: "2026-09-13T18:00:00.000Z",
                    endTime: "2026-09-13T21:10:00.000Z",
                },
                now,
            ),
        ).toBe(false);
    });
});

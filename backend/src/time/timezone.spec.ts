import {
    assertIanaTimeZone,
    buildIcs,
    defaultEndUtc,
    googleCalendarUrl,
    icsUtcStamp,
    outlookCalendarUrl,
    parseScheduleInput,
    scheduleStatus,
    zonedLocalToUtc,
} from "./timezone";

describe("timezone conversion", () => {
    it("converts Budapest winter local time to UTC", () => {
        const utc = zonedLocalToUtc("2026-12-15T20:00", "Europe/Budapest");
        expect(utc.toISOString()).toBe("2026-12-15T19:00:00.000Z");
    });

    it("converts Budapest summer (DST) local time to UTC", () => {
        const utc = zonedLocalToUtc("2026-07-15T20:00", "Europe/Budapest");
        expect(utc.toISOString()).toBe("2026-07-15T18:00:00.000Z");
    });

    it("converts London and New York independently of DST", () => {
        expect(zonedLocalToUtc("2026-12-15T20:00", "Europe/London").toISOString()).toBe(
            "2026-12-15T20:00:00.000Z",
        );
        expect(zonedLocalToUtc("2026-07-15T20:00", "Europe/London").toISOString()).toBe(
            "2026-07-15T19:00:00.000Z",
        );
        expect(zonedLocalToUtc("2026-12-15T14:00", "America/New_York").toISOString()).toBe(
            "2026-12-15T19:00:00.000Z",
        );
        expect(zonedLocalToUtc("2026-07-15T14:00", "America/New_York").toISOString()).toBe(
            "2026-07-15T18:00:00.000Z",
        );
    });

    it("rejects unknown IANA zones", () => {
        expect(() => assertIanaTimeZone("Budapest")).toThrow();
    });

    it("parses phone datetime-local with seconds and milliseconds", () => {
        const utc = zonedLocalToUtc("2026-12-15T20:00:00.000", "Europe/Budapest");
        expect(utc.toISOString()).toBe("2026-12-15T19:00:00.000Z");
    });

    it("parses wall clock + timezone without treating ISO as already UTC", () => {
        const parsed = parseScheduleInput({
            startLocal: "2026-12-15T20:00",
            timezone: "Europe/Budapest",
        });
        expect(parsed.startAtUtc?.toISOString()).toBe("2026-12-15T19:00:00.000Z");
        expect(parsed.timezone).toBe("Europe/Budapest");
    });
});

describe("schedule status from UTC", () => {
    const start = new Date("2026-12-15T19:00:00Z");
    const end = new Date("2026-12-15T21:00:00Z");

    it("is upcoming before start", () => {
        expect(
            scheduleStatus({ startAtUtc: start, endAtUtc: end, now: new Date("2026-12-15T18:00:00Z") }),
        ).toBe("upcoming");
    });

    it("is live only when flagged live, not merely inside the planned window", () => {
        expect(scheduleStatus({ startAtUtc: start, live: true, now: new Date("2026-12-15T18:00:00Z") })).toBe(
            "live",
        );
        expect(
            scheduleStatus({ startAtUtc: start, endAtUtc: end, now: new Date("2026-12-15T20:00:00Z") }),
        ).toBe("delayed");
    });

    it("is delayed after start without a live flag, then missed after 2 hours", () => {
        expect(scheduleStatus({ startAtUtc: start, now: new Date("2026-12-15T20:00:00Z") })).toBe("delayed");
        expect(scheduleStatus({ startAtUtc: start, now: new Date("2026-12-15T21:01:00Z") })).toBe("missed");
        expect(
            scheduleStatus({
                startAtUtc: start,
                wentLiveAt: start,
                now: new Date("2026-12-15T20:00:00Z"),
            }),
        ).toBe("ended");
    });

    it("is ended after endAtUtc only once the stream has actually started", () => {
        expect(
            scheduleStatus({
                startAtUtc: start,
                endAtUtc: end,
                wentLiveAt: start,
                now: new Date("2026-12-15T22:00:00Z"),
            }),
        ).toBe("ended");
    });
});

describe("browser timezone detection", () => {
    it("reads Intl.DateTimeFormat resolvedOptions().timeZone", () => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        expect(typeof tz).toBe("string");
        expect(tz.length).toBeGreaterThan(2);
        expect(() => assertIanaTimeZone(tz)).not.toThrow();
    });
});

describe("calendar export", () => {
    const start = new Date("2026-12-15T19:00:00.000Z");
    const end = defaultEndUtc(start);

    it("emits UTC DTSTART/DTEND", () => {
        const ics = buildIcs({
            title: "Teszt adás",
            startAtUtc: start,
            endAtUtc: end,
            timezone: "Europe/Budapest",
            url: "https://example.test/shows/1",
        });
        expect(ics).toContain(`DTSTART:${icsUtcStamp(start)}`);
        expect(ics).toContain(`DTEND:${icsUtcStamp(end)}`);
        expect(ics).toContain("Europe/Budapest");
    });

    it("builds Google and Outlook UTC links", () => {
        const g = googleCalendarUrl({ title: "Teszt", startAtUtc: start, endAtUtc: end });
        const o = outlookCalendarUrl({ title: "Teszt", startAtUtc: start, endAtUtc: end });
        expect(g).toContain("calendar.google.com");
        expect(g).toContain(icsUtcStamp(start));
        expect(o).toContain("outlook.live.com");
        expect(o).toContain("2026-12-15T19");
    });
});

import {
    blockedServicesForEvent,
    composeComponentState,
    matchingBlockedService,
    noticeDue,
    NOTICE_WINDOWS_MS,
    parseServices,
    shouldSkipMaintenancePath,
} from "./maintenance-rules";

describe("maintenance rules", () => {
    it("does not block informational events", () => {
        expect(
            blockedServicesForEvent({ status: "active", kind: "info", services: ["live_stream"] }),
        ).toEqual([]);
    });

    it("blocks selected services on partial, all services on empty full mode", () => {
        expect(
            blockedServicesForEvent({ status: "active", kind: "partial", services: ["tickets", "payment"] }),
        ).toEqual(["tickets", "payment"]);
        expect(blockedServicesForEvent({ status: "active", kind: "full", services: [] }).includes("live_stream")).toBe(
            true,
        );
        expect(blockedServicesForEvent({ status: "scheduled", kind: "full", services: [] })).toEqual([]);
    });

    it("maps stream start and ticket purchase, skips health and webhooks", () => {
        expect(shouldSkipMaintenancePath("/health/ready", "GET")).toBe(true);
        expect(shouldSkipMaintenancePath("/admin/maintenance", "POST")).toBe(true);
        expect(matchingBlockedService("/ingest/start", "POST", ["live_stream"])).toBe("live_stream");
        expect(matchingBlockedService("/streamer/shows/s1/live", "POST", ["live_stream"], { live: true })).toBe(
            "live_stream",
        );
        expect(matchingBlockedService("/streamer/shows/s1/live", "POST", ["live_stream"], { live: false })).toBe(null);
        expect(matchingBlockedService("/tickets/packs", "POST", ["tickets"])).toBe("tickets");
        expect(matchingBlockedService("/auth/csrf", "POST", ["api"])).toBe(null);
        expect(matchingBlockedService("/shows/x/chat", "POST", ["chat"])).toBe("chat");
        expect(matchingBlockedService("/output/abc/index.m3u8", "GET", ["hls"])).toBe("hls");
    });

    it("prefers outage over maintenance on the status page", () => {
        expect(composeComponentState({ maintenance: true, health: "error" })).toBe("outage");
        expect(composeComponentState({ maintenance: true, health: "ok" })).toBe("maintenance");
        expect(composeComponentState({ maintenance: false, health: "ok" })).toBe("operational");
        expect(composeComponentState({ maintenance: false, health: "skip" })).toBe("degraded");
    });

    it("fires 24h / 1h / 10m notices before start, not after", () => {
        const start = new Date("2026-10-15T02:00:00.000Z");
        expect(noticeDue(start, new Date("2026-10-14T02:00:00.000Z"), NOTICE_WINDOWS_MS.h24, false)).toBe(true);
        expect(noticeDue(start, new Date("2026-10-14T01:00:00.000Z"), NOTICE_WINDOWS_MS.h24, false)).toBe(false);
        expect(noticeDue(start, new Date("2026-10-15T01:50:00.000Z"), NOTICE_WINDOWS_MS.m10, false)).toBe(true);
        expect(noticeDue(start, new Date("2026-10-15T02:01:00.000Z"), NOTICE_WINDOWS_MS.m10, false)).toBe(false);
        expect(noticeDue(start, new Date("2026-10-15T01:50:00.000Z"), NOTICE_WINDOWS_MS.m10, true)).toBe(false);
        expect(parseServices(["tickets", "nope", "tickets"])).toEqual(["tickets"]);
    });
});

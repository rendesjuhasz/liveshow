import {
    livekitHttpUrl,
    livekitRoomName,
    liveVideoBackendDefault,
    lockLiveVideoBackend,
    tokenRefreshDelayMs,
    usesLivekitForShow,
} from "./livekit-config";

describe("livekit-config", () => {
    const prev: Record<string, string | undefined> = {};

    function setEnv(map: Record<string, string | undefined>) {
        for (const [key, value] of Object.entries(map)) {
            prev[key] = process.env[key];
            if (value == null) delete process.env[key];
            else process.env[key] = value;
        }
    }

    afterEach(() => {
        for (const [key, value] of Object.entries(prev)) {
            if (value == null) delete process.env[key];
            else process.env[key] = value;
        }
        for (const key of Object.keys(prev)) delete prev[key];
    });

    it("names rooms after show id", () => {
        expect(livekitRoomName("abc-123")).toBe("show:abc-123");
    });

    it("defaults to mesh when LiveKit keys are missing", () => {
        setEnv({
            LIVEKIT_API_KEY: "",
            LIVEKIT_API_SECRET: "",
            LIVEKIT_PUBLIC_URL: "",
            LIVEKIT_URL: "",
            LIVE_VIDEO_BACKEND: "",
            LIVEKIT_SHOW_IDS: "",
        });
        expect(liveVideoBackendDefault()).toBe("mesh");
        expect(usesLivekitForShow("show-1")).toBe(false);
    });

    it("uses allowlist even when default is mesh", () => {
        setEnv({
            LIVEKIT_API_KEY: "devkey",
            LIVEKIT_API_SECRET: "devsecret",
            LIVEKIT_PUBLIC_URL: "wss://live.example",
            LIVE_VIDEO_BACKEND: "mesh",
            LIVEKIT_SHOW_IDS: "show-a, show-b",
        });
        expect(usesLivekitForShow("show-a")).toBe(true);
        expect(usesLivekitForShow("show-c")).toBe(false);
    });

    it("uses livekit for every show when flag is livekit", () => {
        setEnv({
            LIVEKIT_API_KEY: "devkey",
            LIVEKIT_API_SECRET: "devsecret",
            LIVEKIT_PUBLIC_URL: "wss://live.example",
            LIVE_VIDEO_BACKEND: "livekit",
            LIVEKIT_SHOW_IDS: "",
        });
        expect(usesLivekitForShow("any")).toBe(true);
    });

    it("refreshes tokens at 80% of TTL", () => {
        expect(tokenRefreshDelayMs(3600)).toBe(2_880_000);
        expect(tokenRefreshDelayMs(60)).toBe(48_000);
        expect(tokenRefreshDelayMs(10)).toBe(48_000);
    });

    it("probes LiveKit over HTTP, not wss", () => {
        setEnv({ LIVEKIT_URL: "wss://live.example" });
        expect(livekitHttpUrl()).toBe("http://127.0.0.1:7880");
        setEnv({ LIVEKIT_URL: "http://127.0.0.1:7880/" });
        expect(livekitHttpUrl()).toBe("http://127.0.0.1:7880");
    });

    it("locks the first live backend and ignores later switches", () => {
        expect(lockLiveVideoBackend(null, null)).toBeNull();
        expect(lockLiveVideoBackend(null, "livekit")).toBe("livekit");
        expect(lockLiveVideoBackend("livekit", "mesh")).toBe("livekit");
        expect(lockLiveVideoBackend("mesh", "livekit")).toBe("mesh");
    });
});

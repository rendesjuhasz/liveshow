import { LiveVideoSessionService } from "./live-video-session";

describe("LiveVideoSessionService", () => {
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

    it("keeps the first backend for the rest of the stream", () => {
        setEnv({
            LIVEKIT_API_KEY: "",
            LIVEKIT_API_SECRET: "",
            LIVEKIT_PUBLIC_URL: "",
            LIVEKIT_URL: "",
            LIVE_VIDEO_BACKEND: "mesh",
            LIVEKIT_SHOW_IDS: "",
        });
        const session = new LiveVideoSessionService();
        expect(session.set("show-1", "mesh")).toBe(true);
        expect(session.set("show-1", "livekit")).toBe(false);
        expect(session.get("show-1")).toBe("mesh");
        session.clear("show-1");
        expect(session.set("show-1", "mesh")).toBe(true);
        expect(session.get("show-1")).toBe("mesh");
    });

    it("rejects a lock that does not match the planned backend", () => {
        setEnv({
            LIVEKIT_API_KEY: "",
            LIVEKIT_API_SECRET: "",
            LIVEKIT_PUBLIC_URL: "",
            LIVEKIT_URL: "",
            LIVE_VIDEO_BACKEND: "mesh",
            LIVEKIT_SHOW_IDS: "",
        });
        const session = new LiveVideoSessionService();
        expect(session.set("show-1", "livekit")).toBe(false);
        expect(session.get("show-1")).toBeNull();
    });
});

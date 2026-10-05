import {
    applyGlobalRateLimit,
    HLS_IP_ABUSE_MAX_PER_MIN,
    HLS_VIEWER_MAX_PER_MIN,
} from "./rate-limit";

function hlsReq(over: { userId?: string; token?: string; ip?: string }) {
    const userId = over.userId || "";
    const token = over.token || "signed-token";
    const q = `token=${token}&expiresAt=9999999999&userId=${encodeURIComponent(userId)}`;
    return {
        method: "GET",
        ip: over.ip || "10.0.0.8",
        originalUrl: `/output/show1/index.m3u8?${q}`,
        query: { token, expiresAt: "9999999999", userId },
    };
}

describe("HLS rate limit", () => {
    it("does not 429 many viewers on the same NAT IP", async () => {
        const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
        for (let n = 0; n < 650; n++) {
            await applyGlobalRateLimit(hlsReq({ ip, userId: `viewer-${n}` }));
        }
    });

    it("throttles a single viewer after the per-session cap", async () => {
        const ip = "198.51.100.9";
        const userId = `solo-${Date.now()}`;
        for (let n = 0; n < HLS_VIEWER_MAX_PER_MIN; n++) {
            await applyGlobalRateLimit(hlsReq({ ip, userId }));
        }
        await expect(applyGlobalRateLimit(hlsReq({ ip, userId }))).rejects.toThrow(/Túl sok kérés/);
    });

    it("keeps an IP abuse ceiling above one office NAT", () => {
        expect(HLS_IP_ABUSE_MAX_PER_MIN).toBeGreaterThan(600);
        expect(HLS_IP_ABUSE_MAX_PER_MIN).toBeGreaterThan(HLS_VIEWER_MAX_PER_MIN * 8);
    });
});

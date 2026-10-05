process.env.JWT_SECRET = "test-oauth-state-secret-32chars-min!!";

import { createOAuthState, readOAuthState, safeOAuthNextPath } from "./oauth-state";

describe("oauth state", () => {
    it("round-trips a signed next path", () => {
        const raw = createOAuthState("google", "/shows/abc", "nonce1");
        const parsed = readOAuthState(raw, "google");
        expect(parsed.p).toBe("google");
        expect(parsed.next).toBe("/shows/abc");
        expect(parsed.n).toBe("nonce1");
    });

    it("rejects a different provider", () => {
        const raw = createOAuthState("google", "/", "n");
        expect(() => readOAuthState(raw, "apple")).toThrow("invalid_state");
    });

    it("sanitizes return paths", () => {
        expect(safeOAuthNextPath("https://evil.test")).toBe("/");
        expect(safeOAuthNextPath("/admin")).toBe("/");
        expect(safeOAuthNextPath("/live/1")).toBe("/live/1");
    });
});

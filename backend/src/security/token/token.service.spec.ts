import { TokenService } from "./token.service";

describe("stream token (ticket-gated HLS)", () => {
    const prev = process.env.STREAM_SECRET;

    beforeAll(() => {
        process.env.STREAM_SECRET = "p0-test-secret";
    });

    afterAll(() => {
        process.env.STREAM_SECRET = prev;
    });

    it("binds the HMAC to userId and IP so another session cannot reuse the playlist", () => {
        const tokens = new TokenService();
        const issued = tokens.generateStreamToken("show-1", 120, "user-a", "10.0.0.1");
        expect(tokens.validateStreamToken("show-1", issued.token, issued.expiresAt, "user-a", "10.0.0.1")).toBe(true);
        expect(tokens.validateStreamToken("show-1", issued.token, issued.expiresAt, "user-b", "10.0.0.1")).toBe(false);
        expect(tokens.validateStreamToken("show-1", issued.token, issued.expiresAt, "user-a", "10.0.0.2")).toBe(false);
        expect(tokens.validateStreamToken("other-stream", issued.token, issued.expiresAt, "user-a", "10.0.0.1")).toBe(false);
        expect(issued.expiresAt - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(300);
    });
});

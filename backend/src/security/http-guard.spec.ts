import { isHttpsRequest } from "./http-guard";

describe("isHttpsRequest", () => {
    const prev = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = prev;
    });

    it("treats Cloudflare quick tunnels as HTTPS even when Nest sees http", () => {
        process.env.NODE_ENV = "development";
        expect(
            isHttpsRequest({
                headers: {
                    host: "127.0.0.1:3200",
                    "x-forwarded-proto": "http",
                    "x-liveshow-client-host": "wallet-inventory-vatican-blacks.trycloudflare.com",
                },
            }),
        ).toBe(true);
        expect(
            isHttpsRequest({
                headers: {
                    host: "127.0.0.1:3200",
                    "x-forwarded-host": "demo.trycloudflare.com",
                    "x-forwarded-proto": "http",
                },
            }),
        ).toBe(true);
    });

    it("keeps local http as non-secure in development", () => {
        process.env.NODE_ENV = "development";
        expect(
            isHttpsRequest({
                headers: {
                    host: "127.0.0.1:3200",
                    "x-forwarded-proto": "http",
                    origin: "http://localhost:3000",
                },
            }),
        ).toBe(false);
    });
});

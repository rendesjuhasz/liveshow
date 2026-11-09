import { isDevPayAllowed } from "./secrets";

describe("isDevPayAllowed", () => {
    const prevNode = process.env.NODE_ENV;
    const prevFlag = process.env.ALLOW_DEV_PAY;

    afterEach(() => {
        process.env.NODE_ENV = prevNode;
        if (prevFlag === undefined) delete process.env.ALLOW_DEV_PAY;
        else process.env.ALLOW_DEV_PAY = prevFlag;
    });

    it("allows an explicit flag even when NODE_ENV is production", () => {
        process.env.NODE_ENV = "production";
        process.env.ALLOW_DEV_PAY = "true";
        expect(isDevPayAllowed()).toBe(true);
    });

    it("stays off in production when the flag is unset", () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_PAY;
        expect(isDevPayAllowed()).toBe(false);
    });

    it("stays on in development when the flag is unset", () => {
        process.env.NODE_ENV = "development";
        delete process.env.ALLOW_DEV_PAY;
        expect(isDevPayAllowed()).toBe(true);
    });
});

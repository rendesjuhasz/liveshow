import { sanitizeUserText } from "./sanitize-text";
import { assertSafeId } from "./sql-ids";

describe("sanitizeUserText", () => {
    it("strips html tags", () => {
        expect(sanitizeUserText("<script>alert(1)</script>hello")).toBe("alert(1)hello");
    });
});

describe("assertSafeId", () => {
    it("accepts uuid", () => {
        expect(assertSafeId("550e8400-e29b-41d4-a716-446655440000")).toBe(
            "550e8400-e29b-41d4-a716-446655440000",
        );
    });

    it("rejects sql payload", () => {
        expect(() => assertSafeId("1; drop table users")).toThrow();
    });
});

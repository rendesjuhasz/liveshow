import { guestViewerId } from "./viewer-id";

describe("guestViewerId", () => {
    it("uses a provided viewer key", () => {
        expect(guestViewerId("abcd1234")).toBe("guest:abcd1234");
    });

    it("never collapses anonymous viewers to a shared guest identity", () => {
        const a = guestViewerId("");
        const b = guestViewerId(null);
        expect(a).toMatch(/^guest:[a-z0-9]{32}$/);
        expect(b).toMatch(/^guest:[a-z0-9]{32}$/);
        expect(a).not.toBe("guest");
        expect(a).not.toBe(b);
    });

    it("rejects short or punctuated keys", () => {
        const id = guestViewerId("abc");
        expect(id).toMatch(/^guest:[a-z0-9]{32}$/);
        expect(id).not.toBe("guest:abc");
    });
});

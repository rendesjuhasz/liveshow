import {
    likePattern,
    messagePreview,
    parseContactPaging,
    parseContactStatusFilter,
    parseContactStatusValue,
} from "./contact-query";

describe("contact query helpers", () => {
    it("parses status filters", () => {
        expect(parseContactStatusFilter(undefined)).toBe("all");
        expect(parseContactStatusFilter("NEW")).toBe("new");
        expect(parseContactStatusFilter("opened")).toBe("opened");
        expect(() => parseContactStatusFilter("closed")).toThrow();
        expect(parseContactStatusValue("replied")).toBe("replied");
    });

    it("clamps paging to 25 or 50", () => {
        expect(parseContactPaging(0, 10)).toEqual({ page: 1, pageSize: 25, skip: 0 });
        expect(parseContactPaging(3, 50)).toEqual({ page: 3, pageSize: 50, skip: 100 });
    });

    it("strips LIKE wildcards and previews text", () => {
        expect(likePattern("a%b_c")).toBe("%a b c%");
        expect(messagePreview("  hello   world  ", 20)).toBe("hello world");
        expect(messagePreview("x".repeat(150)).endsWith("…")).toBe(true);
    });
});

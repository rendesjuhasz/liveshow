import { autoPosterStoredPath, isAutoPosterPath, posterSeekSeconds, shouldReplaceShowImage } from "./show-poster";

describe("show-poster", () => {
    const id = "0dd1e7b1-ade6-4e4b-a108-4090a1d8db22";

    it("keeps a custom cover", () => {
        expect(shouldReplaceShowImage("/uploads/covers/custom.jpg", id)).toBe(false);
        expect(shouldReplaceShowImage("https://cdn.example/cover.jpg", id)).toBe(false);
    });

    it("fills empty or previous auto poster", () => {
        expect(shouldReplaceShowImage(null, id)).toBe(true);
        expect(shouldReplaceShowImage("", id)).toBe(true);
        expect(shouldReplaceShowImage(autoPosterStoredPath(id), id)).toBe(true);
        expect(isAutoPosterPath(autoPosterStoredPath(id) + "?e=1", id)).toBe(true);
    });

    it("seeks into the video instead of frame 0 for longer files", () => {
        expect(posterSeekSeconds(0)).toBe(0);
        expect(posterSeekSeconds(20)).toBeGreaterThan(1);
        expect(posterSeekSeconds(120)).toBe(8);
        expect(posterSeekSeconds(2)).toBeLessThan(2);
    });
});

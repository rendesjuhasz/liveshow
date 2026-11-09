import { shouldShowOriginalLanguageBadge } from "../../../frontend/lib/original-language-badge";

describe("shouldShowOriginalLanguageBadge", () => {
    it("shows the badge when the viewer language differs and there is no saved translation", () => {
        expect(shouldShowOriginalLanguageBadge("hu", "en", false)).toBe(true);
    });

    it("hides the badge when a translation is applied", () => {
        expect(shouldShowOriginalLanguageBadge("hu", "en", true)).toBe(false);
    });

    it("hides the badge when the viewer language matches the original", () => {
        expect(shouldShowOriginalLanguageBadge("hu", "hu", false)).toBe(false);
    });
});

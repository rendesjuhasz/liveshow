import { chatSpamReason, collectBannedWords, findBannedWord } from "./question-filters";

describe("moderation filters", () => {
    it("blocks chat urls and contact", () => {
        expect(chatSpamReason("nézd meg https://evil.test")).toBeTruthy();
        expect(chatSpamReason("keress telegram: foo")).toBeTruthy();
        expect(chatSpamReason("Szia")).toBeNull();
    });

    it("hits expanded banned list", () => {
        const words = collectBannedWords([]);
        expect(findBannedWord("ez egy faszfej volt", words)).toBeTruthy();
        expect(findBannedWord("ingyen bitcoin most", words)).toBeTruthy();
        expect(findBannedWord("Hülye vagy", words)).toBeTruthy();
        expect(findBannedWord("szép műsor", words)).toBeNull();
    });
});

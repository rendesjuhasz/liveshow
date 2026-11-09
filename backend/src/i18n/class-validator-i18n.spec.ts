import { localizeClassValidatorMessage } from "./class-validator-i18n";

describe("localizeClassValidatorMessage", () => {
    it("translates max length on hu", () => {
        expect(
            localizeClassValidatorMessage("title must be shorter than or equal to 200 characters", "hu"),
        ).toBe("Legfeljebb 200 karakter lehet.");
    });

    it("translates max length on en", () => {
        expect(
            localizeClassValidatorMessage("title must be shorter than or equal to 200 characters", "en"),
        ).toBe("Must be at most 200 characters.");
    });

    it("leaves unknown English text unchanged", () => {
        expect(localizeClassValidatorMessage("something custom", "hu")).toBe("something custom");
    });
});

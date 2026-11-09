import { join } from "path";
import { auditDictionaries } from "./dictionary-audit";

describe("i18n dictionary audit", () => {
    const frontend = join(__dirname, "../../../frontend");
    const report = auditDictionaries({
        backendRoot: join(__dirname, ".."),
        frontendRoots: [
            join(frontend, "app"),
            join(frontend, "components"),
            join(frontend, "lib"),
            join(frontend, "context"),
            join(frontend, "api"),
        ],
        frontendMessages: join(frontend, "lib/i18n/messages.ts"),
    });

    it("has no t()/translate() keys missing from the backend dictionary", () => {
        expect(report.backendMissing).toEqual([]);
    });

    it("has no t()/translate() keys missing from the frontend dictionary", () => {
        expect(report.frontendMissing).toEqual([]);
    });

    it("has no empty backend dictionary cells", () => {
        expect(report.backendCells.missingOrEmpty).toEqual([]);
    });

    it("has matching placeholders across backend locales", () => {
        expect(report.backendCells.placeholderMismatch).toEqual([]);
    });

    it("has no empty frontend dictionary cells", () => {
        expect(report.frontendCells.missingOrEmpty).toEqual([]);
    });

    it("has matching placeholders across frontend locales", () => {
        expect(report.frontendCells.placeholderMismatch).toEqual([]);
    });
});

import { BadRequestException } from "@nestjs/common";
import {
    assertValidUsername,
    isUsernameConflict,
    USERNAME_TAKEN_MESSAGE,
} from "./username";

describe("username", () => {
    it("accepts lowercase handles", () => {
        expect(assertValidUsername("Teszt_01")).toBe("teszt_01");
    });

    it("rejects short or invalid values", () => {
        expect(() => assertValidUsername("ab")).toThrow(BadRequestException);
        expect(() => assertValidUsername("Bad Name")).toThrow(BadRequestException);
    });

    it("treats reserved words as taken", () => {
        expect(() => assertValidUsername("admin")).toThrow(BadRequestException);
        try {
            assertValidUsername("admin");
        } catch (err) {
            expect((err as BadRequestException).message).toBe(USERNAME_TAKEN_MESSAGE);
        }
    });

    it("detects unique conflicts", () => {
        expect(isUsernameConflict({ meta: { target: ["username"] } })).toBe(true);
        expect(isUsernameConflict(new Error("duplicate key username"))).toBe(true);
        expect(isUsernameConflict(new Error("other"))).toBe(false);
    });
});

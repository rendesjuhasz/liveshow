import { isAdminRole, normalizeRole, USER_ROLES } from "./roles";

describe("isAdminRole", () => {
    it("grants admin only from DB role or isAdmin flag", () => {
        expect(isAdminRole({ role: USER_ROLES.ADMIN })).toBe(true);
        expect(isAdminRole({ role: "user", isAdmin: true })).toBe(true);
        expect(isAdminRole({ role: "user" })).toBe(false);
        expect(isAdminRole({ role: "streamer" })).toBe(false);
        expect(isAdminRole({ role: "user", email: "admin@admin.com" } as { role: string })).toBe(false);
    });

    it("normalizes unknown roles to user", () => {
        expect(normalizeRole("ADMIN")).toBe(USER_ROLES.ADMIN);
        expect(normalizeRole("nope")).toBe(USER_ROLES.USER);
    });
});

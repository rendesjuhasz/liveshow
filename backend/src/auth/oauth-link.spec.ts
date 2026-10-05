import { decideOAuthLink, safeAvatarUrl } from "./oauth-link";

describe("decideOAuthLink", () => {
    it("logs in by provider id even if email is missing", () => {
        expect(
            decideOAuthLink({
                providerUserId: "sub-1",
                email: null,
                emailVerified: false,
                existingByProviderId: { id: "u1" },
                existingByEmail: null,
            }),
        ).toEqual({ action: "login", userId: "u1" });
    });

    it("links an existing email/password account", () => {
        expect(
            decideOAuthLink({
                providerUserId: "sub-1",
                email: "a@b.co",
                emailVerified: true,
                existingByProviderId: null,
                existingByEmail: { id: "u2", boundProviderId: null },
            }),
        ).toEqual({ action: "link", userId: "u2" });
    });

    it("creates a new user when email is unused", () => {
        expect(
            decideOAuthLink({
                providerUserId: "sub-1",
                email: "new@b.co",
                emailVerified: true,
                existingByProviderId: null,
                existingByEmail: null,
            }),
        ).toEqual({ action: "create" });
    });

    it("rejects unverified email for a new account", () => {
        expect(
            decideOAuthLink({
                providerUserId: "sub-1",
                email: "new@b.co",
                emailVerified: false,
                existingByProviderId: null,
                existingByEmail: null,
            }),
        ).toEqual({ action: "conflict" });
    });

    it("rejects a second identity bound to a different provider user", () => {
        expect(
            decideOAuthLink({
                providerUserId: "sub-2",
                email: "a@b.co",
                emailVerified: true,
                existingByProviderId: null,
                existingByEmail: { id: "u2", boundProviderId: "sub-1" },
            }),
        ).toEqual({ action: "conflict" });
    });
});

describe("safeAvatarUrl", () => {
    it("keeps https profile photos only", () => {
        expect(safeAvatarUrl("https://lh3.googleusercontent.com/a/x")).toContain("https://");
        expect(safeAvatarUrl("http://evil")).toBeNull();
        expect(safeAvatarUrl("javascript:alert(1)")).toBeNull();
    });
});

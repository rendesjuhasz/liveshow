export const OAUTH_PROVIDERS = ["google", "microsoft", "apple"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: string): value is OAuthProvider {
    return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export function providerIdField(provider: OAuthProvider): "googleId" | "microsoftId" | "appleId" {
    if (provider === "google") return "googleId";
    if (provider === "microsoft") return "microsoftId";
    return "appleId";
}

export type OAuthLinkDecision =
    | { action: "login"; userId: string }
    | { action: "link"; userId: string }
    | { action: "create" }
    | { action: "conflict" };

export function decideOAuthLink(opts: {
    providerUserId: string;
    email: string | null;
    emailVerified: boolean;
    existingByProviderId: { id: string } | null;
    existingByEmail: { id: string; boundProviderId: string | null } | null;
}): OAuthLinkDecision {
    if (opts.existingByProviderId) {
        return { action: "login", userId: opts.existingByProviderId.id };
    }
    if (!opts.email || !opts.emailVerified) {
        return { action: "conflict" };
    }
    if (!opts.existingByEmail) {
        return { action: "create" };
    }
    const bound = String(opts.existingByEmail.boundProviderId || "");
    if (bound && bound !== opts.providerUserId) {
        return { action: "conflict" };
    }
    return { action: "link", userId: opts.existingByEmail.id };
}

export function safeAvatarUrl(raw?: string | null) {
    const value = String(raw || "").trim();
    if (!value.startsWith("https://") || value.length > 500 || /\s/.test(value)) return null;
    return value;
}

import { decryptSecret, encryptSecret, readOAuthState, signOAuthState } from "./marketing.crypto";
import { parseMarketingJson } from "./marketing.prompts";

describe("marketing kit helpers", () => {
    it("parses OpenAI JSON with hashtags and CTAs", () => {
        const kit = parseMarketingJson(
            JSON.stringify({
                facebookPost: "fb",
                linkedinPost: "li",
                xPost: "x post",
                newsletterContent: "nl",
                emailSubject1: "s1",
                emailSubject2: "s2",
                emailSubject3: "s3",
                seoTitle: "title",
                seoDescription: "desc",
                youtubeDescription: "yt",
                blogOutline: "## Egy",
                hashtags: ["live", "show"],
                ctaVariants: ["Nézd", "Csatlakozz"],
                promoPhrases: ["A", "B"],
            }),
        );
        expect(kit.hashtags).toHaveLength(20);
        expect(kit.ctaVariants).toHaveLength(3);
        expect(kit.promoPhrases).toHaveLength(5);
        expect(kit.facebookPost).toBe("fb");
    });

    it("encrypts OAuth tokens and signs state", () => {
        process.env.MARKETING_TOKEN_SECRET = "unit-test-secret";
        const packed = encryptSecret("page-token");
        expect(decryptSecret(packed)).toBe("page-token");
        const state = signOAuthState({ uid: "u1", showId: "s1", provider: "x", exp: String(Math.floor(Date.now() / 1000) + 60) });
        expect(readOAuthState(state).uid).toBe("u1");
    });
});

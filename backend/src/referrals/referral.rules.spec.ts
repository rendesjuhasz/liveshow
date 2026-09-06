import {
    canCreateReferral,
    qualifiesForReward,
    REFERRAL_STATUSES,
    shouldGrantReward,
} from "./referral.rules";

describe("referral rules", () => {
    const base = {
        enabled: true,
        referrerUserId: "A",
        newUserId: "B",
        alreadyReferred: false,
        allowMultipleFromReferrer: true,
        referrerAlreadyHasReferral: false,
    };

    it("blocks self-referral", () => {
        expect(canCreateReferral({ ...base, newUserId: "A" })).toBe(false);
    });

    it("blocks a second referrer for the same account", () => {
        expect(canCreateReferral({ ...base, alreadyReferred: true })).toBe(false);
    });

    it("blocks extra referred users when multiple referrals are disabled", () => {
        expect(
            canCreateReferral({
                ...base,
                allowMultipleFromReferrer: false,
                referrerAlreadyHasReferral: true,
            }),
        ).toBe(false);
    });

    it("allows multiple referred users by default", () => {
        expect(
            canCreateReferral({
                ...base,
                referrerAlreadyHasReferral: true,
            }),
        ).toBe(true);
    });

    it("does not reward until the minimum paid tickets are reached", () => {
        expect(qualifiesForReward(9, 10)).toBe(false);
        expect(qualifiesForReward(10, 10)).toBe(true);
        expect(shouldGrantReward(REFERRAL_STATUSES.PENDING, 9, 10)).toBe(false);
        expect(shouldGrantReward(REFERRAL_STATUSES.PENDING, 10, 10)).toBe(true);
        expect(shouldGrantReward(REFERRAL_STATUSES.REWARDED, 50, 10)).toBe(false);
    });
});

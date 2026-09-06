export const REFERRAL_STATUSES = {
    PENDING: "pending",
    COMPLETED: "completed",
    REWARDED: "rewarded",
} as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[keyof typeof REFERRAL_STATUSES];

export function canCreateReferral(input: {
    enabled: boolean;
    referrerUserId?: string | null;
    newUserId: string;
    alreadyReferred: boolean;
    allowMultipleFromReferrer: boolean;
    referrerAlreadyHasReferral: boolean;
}) {
    if (!input.enabled) return false;
    if (!input.referrerUserId) return false;
    if (input.referrerUserId === input.newUserId) return false;
    if (input.alreadyReferred) return false;
    if (!input.allowMultipleFromReferrer && input.referrerAlreadyHasReferral) return false;
    return true;
}

export function qualifiesForReward(purchasedTickets: number, minimumPurchasedTickets: number) {
    return purchasedTickets >= minimumPurchasedTickets;
}

export function shouldGrantReward(status: string, purchasedTickets: number, minimumPurchasedTickets: number) {
    if (status === REFERRAL_STATUSES.REWARDED) return false;
    return qualifiesForReward(purchasedTickets, minimumPurchasedTickets);
}

import {
    canActivateFromBarion,
    canDemotePackOnPaymentFailure,
    isBarionRefundStatus,
    shouldFulfillConfirmStripe,
    spendCountsTowardPayout,
    stripeObjectFullyRefunded,
} from "./payments-state";

describe("payment / pack state machine", () => {
    it("does not let failed or cancelled webhooks demote a paid pack", () => {
        expect(canDemotePackOnPaymentFailure("paid")).toBe(false);
        expect(canDemotePackOnPaymentFailure("refunded")).toBe(false);
        expect(canDemotePackOnPaymentFailure("pending")).toBe(true);
        expect(canDemotePackOnPaymentFailure("failed")).toBe(true);
    });

    it("treats a fully refunded Stripe charge as a full refund", () => {
        expect(
            stripeObjectFullyRefunded("charge.refunded", { refunded: true, amount: 4000, amount_refunded: 4000 }),
        ).toBe(true);
        expect(
            stripeObjectFullyRefunded("charge.refunded", { refunded: false, amount: 4000, amount_refunded: 4000 }),
        ).toBe(true);
    });

    it("does not treat a partial Stripe refund as a full pack refund", () => {
        expect(
            stripeObjectFullyRefunded("charge.refunded", { refunded: false, amount: 4000, amount_refunded: 1000 }),
        ).toBe(false);
        expect(
            stripeObjectFullyRefunded("refund.created", { status: "succeeded", amount: 1000 }),
        ).toBe(false);
        expect(
            stripeObjectFullyRefunded("refund.updated", {
                status: "succeeded",
                amount: 1000,
                charge: { amount: 4000, amount_refunded: 1000, refunded: false },
            }),
        ).toBe(false);
    });

    it("treats refund.created as full only when the nested charge is fully refunded", () => {
        expect(
            stripeObjectFullyRefunded("refund.created", {
                status: "succeeded",
                amount: 4000,
                charge: { amount: 4000, amount_refunded: 4000, refunded: true },
            }),
        ).toBe(true);
        expect(stripeObjectFullyRefunded("refund.created", { status: "pending", amount: 4000 })).toBe(false);
    });
});

describe("confirm-stripe and Barion refund guards", () => {
    it("does not fulfill Stripe confirm for paid or refunded local rows", () => {
        expect(shouldFulfillConfirmStripe("pending")).toBe(true);
        expect(shouldFulfillConfirmStripe("paid")).toBe(false);
        expect(shouldFulfillConfirmStripe("refunded")).toBe(false);
    });

    it("treats Barion Refunded and PartiallyRefunded as refund statuses", () => {
        expect(isBarionRefundStatus("Refunded")).toBe(true);
        expect(isBarionRefundStatus("PartiallyRefunded")).toBe(true);
        expect(isBarionRefundStatus("Succeeded")).toBe(false);
    });

    it("never activates a locally refunded payment from a later Succeeded poll", () => {
        expect(canActivateFromBarion("refunded", "Succeeded")).toBe(false);
        expect(canActivateFromBarion("paid", "Refunded")).toBe(false);
        expect(canActivateFromBarion("pending", "Succeeded")).toBe(true);
    });
});

describe("refund ledger vs payout", () => {
    it("drops refunded and question_hold rows from payout credit", () => {
        expect(spendCountsTowardPayout("question")).toBe(true);
        expect(spendCountsTowardPayout("review")).toBe(true);
        expect(spendCountsTowardPayout("refunded")).toBe(false);
        expect(spendCountsTowardPayout("question_hold")).toBe(false);
        expect(spendCountsTowardPayout(null)).toBe(true);
    });
});

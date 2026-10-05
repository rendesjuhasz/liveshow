import { giftSpendAmount, isGiftPack, MAX_GIFT_SPENDS_PER_SHOW } from "./ticket-groups";

describe("gift pack classification", () => {
    it("treats source gift and groupKey gift as free", () => {
        expect(isGiftPack({ source: "gift", groupKey: "gift", unitValue: 0 })).toBe(true);
        expect(isGiftPack({ source: "referral", groupKey: "referral", unitValue: 0 })).toBe(true);
        expect(isGiftPack({ source: "purchase", groupKey: "arany", unitValue: 80 })).toBe(false);
    });

    it("never credits payout amount for a gift ticket", () => {
        expect(giftSpendAmount(80, true)).toBe(0);
        expect(giftSpendAmount(80, false)).toBe(80);
    });

    it("caps free spends at 5 per show", () => {
        expect(MAX_GIFT_SPENDS_PER_SHOW).toBe(5);
    });
});

import { giftTicketLines } from "../../../frontend/lib/gift-ticket-hint";

describe("giftTicketLines", () => {
    it("hides the gift row when the wallet has no gift tickets", () => {
        expect(giftTicketLines(0, 5)).toBeNull();
        expect(giftTicketLines(0, 0)).toBeNull();
    });

    it("shows gift balance and remaining uses on this show", () => {
        expect(giftTicketLines(3, 5)).toEqual({ giftBalance: 3, usableOnThisShow: 3 });
        expect(giftTicketLines(10, 2)).toEqual({ giftBalance: 10, usableOnThisShow: 2 });
        expect(giftTicketLines(4, 0)).toEqual({ giftBalance: 4, usableOnThisShow: 0 });
    });
});

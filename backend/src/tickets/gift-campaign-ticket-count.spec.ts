import { parseCampaignTicketCount } from "./gift-campaigns.service";

describe("parseCampaignTicketCount", () => {
    it("defaults to 1", () => {
        expect(parseCampaignTicketCount(undefined)).toBe(1);
        expect(parseCampaignTicketCount(null)).toBe(1);
    });

    it("clamps invalid low values to fallback", () => {
        expect(parseCampaignTicketCount(0)).toBe(1);
        expect(parseCampaignTicketCount(-2, 3)).toBe(3);
    });

    it("accepts a valid count", () => {
        expect(parseCampaignTicketCount(5)).toBe(5);
    });

    it("caps at 10000", () => {
        expect(parseCampaignTicketCount(50_000)).toBe(10_000);
    });
});

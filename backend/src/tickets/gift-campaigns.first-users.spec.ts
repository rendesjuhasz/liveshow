import { GiftCampaignsService } from "./gift-campaigns.service";

function makeService() {
    const prisma = {
        $queryRaw: jest.fn(),
        $transaction: jest.fn(),
        $executeRaw: jest.fn(),
        $executeRawUnsafe: jest.fn(),
    };
    const groups = { grantGiftUnits: jest.fn() };
    const mail = { packPurchased: jest.fn() };
    const svc = new GiftCampaignsService(prisma as any, groups as any, mail as any);
    return { svc, prisma };
}

describe("first_users once per user", () => {
    it("does not claim if the user already has a first_users GiftClaim", async () => {
        const { svc, prisma } = makeService();
        prisma.$queryRaw.mockResolvedValueOnce([{ id: "existing" }]);
        const granted = await svc.tryClaimFirstUsers("u1");
        expect(granted).toEqual([]);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("grants only the first matching campaign", async () => {
        const { svc, prisma } = makeService();
        prisma.$queryRaw
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }]);
        prisma.$transaction.mockResolvedValueOnce({
            campaignGranted: true,
            campaignId: "c1",
            ticketCount: 5,
            packPurchaseId: "p1",
            groupName: "Kampány",
        });
        const granted = await svc.tryClaimFirstUsers("u1");
        expect(granted).toHaveLength(1);
        expect(granted[0].campaignId).toBe("c1");
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
});

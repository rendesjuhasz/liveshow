import { TicketGroupsService } from "./ticket-groups.service";

function makeService() {
    const tx = {
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
        $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([{ n: 1 }]),
        $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const svc = new TicketGroupsService(prisma as any, {} as any, { packPurchased: jest.fn() } as any);
    return { svc, prisma, tx };
}

const giftLot = {
    id: "g1",
    groupName: "Ajándék kérdésjegy",
    groupKey: "gift",
    source: "gift",
    unitValue: 0,
    remainingCount: 3,
};
const paidLot = {
    id: "p1",
    groupName: "Arany",
    groupKey: "arany",
    source: "purchase",
    unitValue: 80,
    remainingCount: 10,
};

describe("spendOne gift vs paid", () => {
    it("spends a gift lot first and credits 0 Ft", async () => {
        const { svc, tx } = makeService();
        tx.$queryRaw
            .mockResolvedValueOnce([{ n: 0 }])
            .mockResolvedValueOnce([giftLot]);
        const result = await svc.spendOne({
            viewerUserId: "u1",
            streamerId: "st1",
            showId: "s1",
            reason: "question",
        });
        expect(result?.isGift).toBe(true);
        expect(result?.calculatedAmount).toBe(0);
        expect(result?.source).toBe("gift");
        expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it("uses a paid lot after 5 gift spends on the same show", async () => {
        const { svc, tx } = makeService();
        tx.$queryRaw
            .mockResolvedValueOnce([{ n: 5 }])
            .mockResolvedValueOnce([paidLot]);
        const result = await svc.spendOne({
            viewerUserId: "u1",
            streamerId: "st1",
            showId: "s1",
            reason: "support",
        });
        expect(result?.isGift).toBe(false);
        expect(result?.calculatedAmount).toBe(80);
        expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("returns null when the gift cap is reached and no paid tickets remain", async () => {
        const { svc, tx } = makeService();
        tx.$queryRaw.mockResolvedValueOnce([{ n: 5 }]).mockResolvedValueOnce([]);
        const result = await svc.spendOne({
            viewerUserId: "u1",
            streamerId: "st1",
            showId: "s1",
        });
        expect(result).toBeNull();
        expect(tx.$executeRaw).not.toHaveBeenCalled();
    });

    it("converts a question hold instead of spending twice", async () => {
        const { svc, tx } = makeService();
        tx.$queryRaw.mockResolvedValueOnce([{ id: "hold-1", questionId: "q1" }]);
        const result = await svc.captureQuestionTicket({
            viewerUserId: "u1",
            streamerId: "st1",
            showId: "s1",
            questionIds: ["q1", "q2"],
        }, tx as any);
        expect(result?.id).toBe("hold-1");
        expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("restores remainingCount when releasing a question hold", async () => {
        const { svc, tx } = makeService();
        tx.$queryRaw.mockResolvedValueOnce([{ id: "hold-1", purchaseId: "p1", ticketsSpent: 1 }]);
        const n = await svc.releaseQuestionHold({ questionId: "q1" }, tx as any);
        expect(n).toBe(1);
        expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    });
});

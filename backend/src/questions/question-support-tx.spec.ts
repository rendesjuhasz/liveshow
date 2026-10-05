import { QuestionsService } from "./questions.service";

function makeService() {
    const tx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn(),
    };
    let rolledBack = false;
    const prisma = {
        show: {
            findUnique: jest.fn().mockResolvedValue({ id: "s1", streamerId: "st1" }),
        },
        $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => {
            try {
                return await fn(tx);
            } catch (err) {
                rolledBack = true;
                throw err;
            }
        }),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn(),
    };
    const ticketGroups = {
        assertCanAsk: jest.fn().mockResolvedValue(1),
        spendOne: jest.fn().mockResolvedValue({ id: "spend-1", ticketsSpent: 1 }),
        balance: jest.fn().mockResolvedValue({ balance: 4, usableOnShow: 4 }),
    };
    const svc = new QuestionsService(prisma as any, ticketGroups as any, { recordOpen: jest.fn() } as any);
    return { svc, prisma, tx, ticketGroups, getRolledBack: () => rolledBack };
}

describe("addSupport ticket + insert transaction", () => {
    it("rolls back the ticket spend when ShowSupport INSERT fails", async () => {
        const { svc, tx, ticketGroups, getRolledBack } = makeService();
        tx.$executeRaw.mockRejectedValueOnce(new Error("insert failed"));

        await expect(
            svc.addSupport("u1", "s1", "support", "Köszönöm a műsort, ez egy teszt."),
        ).rejects.toThrow("insert failed");

        expect(ticketGroups.spendOne).toHaveBeenCalledTimes(1);
        expect(ticketGroups.spendOne.mock.calls[0][1]).toBe(tx);
        expect(getRolledBack()).toBe(true);
        expect(ticketGroups.balance).not.toHaveBeenCalled();
    });

    it("spends and inserts on the same transaction when INSERT succeeds", async () => {
        const { svc, tx, ticketGroups, getRolledBack } = makeService();
        const result = await svc.addSupport("u1", "s1", "support", "Köszönöm a műsort, ez egy teszt.");
        expect(result.spentTicket).toBe(true);
        expect(result.ticketsSpent).toBe(1);
        expect(ticketGroups.spendOne.mock.calls[0][1]).toBe(tx);
        expect(tx.$executeRaw).toHaveBeenCalled();
        expect(getRolledBack()).toBe(false);
    });
});

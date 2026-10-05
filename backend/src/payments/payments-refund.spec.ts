import { PaymentsService } from "./payments.service";
import { REFUND_SPEND_REASON } from "./payments-state";

function makePayments() {
    const prisma = {
        payment: {
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn(),
        },
        ticket: { update: jest.fn().mockResolvedValue({}) },
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn(),
    };
    const svc = new PaymentsService(prisma as any, { packPurchased: jest.fn() } as any, { onPaidPurchase: jest.fn() } as any, {} as any);
    return { svc, prisma };
}

describe("applyRefundLocal pack ledger", () => {
    it("zeros remaining tickets and reverses TicketSpend for the pack", async () => {
        const { svc, prisma } = makePayments();
        prisma.$queryRaw.mockResolvedValueOnce([{ packPurchaseId: "pack-1" }]);
        await (svc as any).applyRefundLocal("pay-1", null);
        expect(prisma.payment.update).toHaveBeenCalledWith({
            where: { id: "pay-1" },
            data: { status: "refunded" },
        });
        const sql = prisma.$executeRaw.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(sql.some((s) => s.includes("TicketSpend") && s.includes("purchaseId"))).toBe(true);
        expect(sql.some((s) => s.includes("remainingCount"))).toBe(true);
        expect(REFUND_SPEND_REASON).toBe("refunded");
    });
});

describe("markFailed pack protection", () => {
    it("updates only unpaid packs when a sibling payment fails", async () => {
        const { svc, prisma } = makePayments();
        prisma.$queryRaw.mockResolvedValueOnce([{ packPurchaseId: "pack-1" }]);
        await (svc as any).markFailed("pay-old", null, "cancelled", "cancelled");
        const sql = String(prisma.$executeRaw.mock.calls[0][0]);
        expect(sql).toContain("TicketPackPurchase");
        expect(sql).toContain("paid");
        expect(sql).toContain("refunded");
    });
});

describe("activatePack does not reset a paid wallet", () => {
    it("returns the existing paid pack without rewriting remainingCount", async () => {
        const { svc, prisma } = makePayments();
        prisma.$queryRaw.mockResolvedValueOnce([
            { id: "pack-1", status: "paid", remainingCount: 3, ticketCount: 10, userId: "u1" },
        ]);
        const row = await svc.activatePack("pack-1");
        expect(row.remainingCount).toBe(3);
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
});

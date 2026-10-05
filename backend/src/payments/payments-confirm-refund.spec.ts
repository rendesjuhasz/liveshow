import { PaymentsService } from "./payments.service";

function makePayments() {
    const refundedPayment = {
        id: "pay-1",
        userId: "u1",
        status: "refunded",
        ticketId: "t1",
        stripeSessionId: "cs_test_1",
        ticket: { id: "t1", status: "refunded", show: { id: "s1" } },
    };
    const prisma = {
        payment: {
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue(refundedPayment),
        },
        ticket: {
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn(),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn(),
    };
    const svc = new PaymentsService(
        prisma as any,
        { packPurchased: jest.fn(), ticketPurchased: jest.fn() } as any,
        { onPaidPurchase: jest.fn() } as any,
        {} as any,
    );
    return { svc, prisma };
}

describe("confirm-stripe after refund", () => {
    const prevKey = process.env.STRIPE_SECRET_KEY;

    beforeEach(() => {
        process.env.STRIPE_SECRET_KEY = "sk_test_refund_guard";
    });

    afterAll(() => {
        process.env.STRIPE_SECRET_KEY = prevKey;
    });

    it("returns the refunded record and never fulfills again", async () => {
        const { svc, prisma } = makePayments();
        const fulfill = jest.spyOn(svc as any, "fulfillPaidRecord");
        const result = await svc.confirmStripeSession("cs_test_1", "u1");

        expect(result).toEqual({ id: "t1", status: "refunded", show: { id: "s1" } });
        expect(fulfill).not.toHaveBeenCalled();
        expect(prisma.payment.update).not.toHaveBeenCalled();
        expect(prisma.ticket.update).not.toHaveBeenCalled();
        fulfill.mockRestore();
    });
});

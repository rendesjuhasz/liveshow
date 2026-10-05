import { barionGetPaymentState } from "./barion.client";
import { PaymentsService } from "./payments.service";
import { REFUND_SPEND_REASON } from "./payments-state";

jest.mock("./barion.client", () => ({
    barionEnabled: jest.fn(() => true),
    barionGetPaymentState: jest.fn(),
    barionRefundPayment: jest.fn(),
    barionStartPayment: jest.fn(),
}));

const getState = barionGetPaymentState as jest.Mock;

function makePayments(payment: Record<string, unknown>) {
    const prisma = {
        payment: {
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue(payment),
            findUniqueOrThrow: jest.fn().mockImplementation(async () => {
                const status = prisma.payment.update.mock.calls.some(
                    (call: { data?: { status?: string } }[]) => call[0]?.data?.status === "refunded",
                )
                    ? "refunded"
                    : payment.status;
                return { ...payment, status };
            }),
        },
        ticket: {
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue({
                id: payment.ticketId,
                status: (payment.ticket as { status?: string } | undefined)?.status || "active",
            }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([
            { packPurchaseId: "pack-1", ticketId: payment.ticketId, id: payment.id },
        ]),
    };
    const svc = new PaymentsService(
        prisma as any,
        { packPurchased: jest.fn(), ticketPurchased: jest.fn() } as any,
        { onPaidPurchase: jest.fn() } as any,
        {} as any,
    );
    return { svc, prisma };
}

describe("Barion refund ledger", () => {
    beforeEach(() => {
        getState.mockReset();
    });

    it("applies local refund and zeros the pack on Refunded", async () => {
        const { svc, prisma } = makePayments({
            id: "pay-1",
            userId: "u1",
            status: "paid",
            ticketId: "t1",
            ticket: { id: "t1", status: "active" },
        });
        getState.mockResolvedValue({
            PaymentRequestId: "pay-1",
            Status: "Refunded",
        });

        await (svc as any).syncBarionPayment("barion-1");

        expect(prisma.payment.update).toHaveBeenCalledWith({
            where: { id: "pay-1" },
            data: { status: "refunded" },
        });
        expect(prisma.ticket.update).toHaveBeenCalledWith({
            where: { id: "t1" },
            data: { status: "refunded" },
        });
        const sql = prisma.$executeRaw.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(sql.some((s) => s.includes("TicketSpend"))).toBe(true);
        expect(sql.some((s) => s.includes("remainingCount"))).toBe(true);
        expect(REFUND_SPEND_REASON).toBe("refunded");
    });

    it("applies local refund on PartiallyRefunded", async () => {
        const { svc, prisma } = makePayments({
            id: "pay-1",
            userId: "u1",
            status: "paid",
            ticketId: "t1",
            ticket: { id: "t1", status: "active" },
        });
        getState.mockResolvedValue({
            PaymentRequestId: "pay-1",
            Status: "PartiallyRefunded",
        });

        await (svc as any).syncBarionPayment("barion-1");

        expect(prisma.payment.update).toHaveBeenCalledWith({
            where: { id: "pay-1" },
            data: { status: "refunded" },
        });
        const sql = prisma.$executeRaw.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(sql.some((s) => s.includes("TicketPackPurchase"))).toBe(true);
    });

    it("does not reactivate after refund when Succeeded is polled", async () => {
        const { svc, prisma } = makePayments({
            id: "pay-1",
            userId: "u1",
            status: "refunded",
            ticketId: "t1",
            ticket: { id: "t1", status: "refunded" },
        });
        getState.mockResolvedValue({
            PaymentRequestId: "pay-1",
            Status: "Succeeded",
        });

        const polled = await svc.getBarionStatus("barion-1", { id: "u1" });
        expect(polled.paymentStatus).toBe("refunded");
        expect(polled.streamAccess).toBe("STREAM_ACCESS_DENIED");
        expect(prisma.payment.update).not.toHaveBeenCalled();
        expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it("does not reactivate after refund when Succeeded arrives on webhook", async () => {
        const { svc, prisma } = makePayments({
            id: "pay-1",
            userId: "u1",
            status: "refunded",
            ticketId: "t1",
            ticket: { id: "t1", status: "refunded" },
        });
        getState.mockResolvedValue({
            PaymentRequestId: "pay-1",
            Status: "Succeeded",
        });

        await svc.handleBarionWebhook("barion-1");
        expect(prisma.payment.update).not.toHaveBeenCalled();
        expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
});

import { PrivateStreamsService } from "./private-streams.service";

jest.mock("../shows/video-category-db", () => ({
    setShowVideoCategory: jest.fn().mockResolvedValue(undefined),
}));

class Mutex {
    private tail = Promise.resolve();

    run<T>(fn: () => Promise<T> | T) {
        const prev = this.tail;
        let release!: () => void;
        this.tail = new Promise<void>((resolve) => {
            release = resolve;
        });
        return prev.then(async () => {
            try {
                return await fn();
            } finally {
                release();
            }
        });
    }
}

function makeCheckout() {
    const request: Record<string, unknown> = {
        id: "r1",
        userId: "u1",
        selectedOfferId: "o1",
        topic: "Privát téma",
        details: "Részletek a kívánságról",
        showId: null,
        ticketId: null,
        selectedStart: new Date("2026-10-04T18:00:00.000Z"),
        status: "awarded",
    };
    const lock = new Mutex();
    const tx = {
        $queryRaw: jest.fn(async (strings: unknown) => {
            const sql = String(strings);
            if (sql.includes("FOR UPDATE") || sql.includes("PrivateRequest")) return [request];
            return [];
        }),
        $executeRaw: jest.fn().mockResolvedValue(1),
        show: {
            create: jest.fn(async () => {
                request.showId = "show-1";
                return { id: "show-1" };
            }),
        },
        ticket: {
            create: jest.fn(async () => {
                request.ticketId = "t1";
                return { id: "t1", userId: "u1", showId: request.showId, price: 5000, status: "pending" };
            }),
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn(async () => ({
                id: request.ticketId,
                userId: "u1",
                showId: request.showId,
                price: 5000,
                status: "pending",
            })),
        },
    };
    const prisma = {
        $transaction: jest.fn((fn: (client: typeof tx) => unknown) => lock.run(() => fn(tx))),
        $queryRaw: jest.fn(async (strings: unknown) => {
            const sql = String(strings);
            if (sql.includes("PrivateOffer")) {
                return [{ id: "o1", price: 5000, streamerId: "st1", streamerName: "Ada" }];
            }
            if (sql.includes("PrivateRequest")) return [request];
            return [];
        }),
        $executeRaw: jest.fn().mockResolvedValue(1),
        ticket: { findUnique: jest.fn() },
        show: { create: jest.fn() },
    };
    const payments = {
        createForTicket: jest.fn(async (ticket: { id: string }) => ({
            payment: { id: `pay-${ticket.id}` },
            checkoutUrl: "https://pay.example/session",
            devPay: false,
        })),
    };
    const svc = new PrivateStreamsService(
        prisma as any,
        payments as any,
        { notifyPublished: jest.fn() } as any,
    );
    return { svc, prisma, tx, payments, request };
}

describe("private checkout double click", () => {
    it("creates one show, one ticket, and reuses that ticket for both clicks", async () => {
        const { svc, tx, payments } = makeCheckout();

        const [first, second] = await Promise.all([svc.checkout("u1", "r1"), svc.checkout("u1", "r1")]);

        expect(tx.show.create).toHaveBeenCalledTimes(1);
        expect(tx.ticket.create).toHaveBeenCalledTimes(1);
        expect(payments.createForTicket).toHaveBeenCalledTimes(2);
        expect(payments.createForTicket.mock.calls[0][0].id).toBe("t1");
        expect(payments.createForTicket.mock.calls[1][0].id).toBe("t1");
        expect(first.ticketId).toBe("t1");
        expect(second.ticketId).toBe("t1");
        expect(first.paymentId).toBe(second.paymentId);
        expect(String(tx.$queryRaw.mock.calls[0][0])).toContain("pg_advisory_xact_lock");
        expect(String(tx.$queryRaw.mock.calls[1][0])).toContain("FOR UPDATE");
    });
});

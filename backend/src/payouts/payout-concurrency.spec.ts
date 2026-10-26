import { BadRequestException } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";
import { canReservePayout, computeStreamerRevenue } from "./revenue";

jest.mock("./revenue", () => {
    const actual = jest.requireActual("./revenue");
    return { ...actual, computeStreamerRevenue: jest.fn() };
});

const compute = computeStreamerRevenue as jest.MockedFunction<typeof computeStreamerRevenue>;

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

function revenueStub(available: number) {
    return {
        available,
        gross: 10000,
        commission: 0,
        net: 10000,
        commissionPercent: 0,
        streamerPercent: 100,
        ticketsSold: 1,
        shows: [{ title: "Show", tickets: 1, gross: 10000, commission: 0, net: 10000, platformPercent: 0 }],
    } as any;
}

describe("payout reservation concurrency", () => {
    it("does not reserve the same available balance twice under a lock", async () => {
        const lock = new Mutex();
        let available = 10000;
        let reserved = 0;

        const request = (amount: number) =>
            lock.run(() => {
                if (!canReservePayout(available, amount)) return "reject";
                reserved += amount;
                available -= amount;
                return "ok";
            });

        const results = await Promise.all([request(10000), request(10000), request(10000)]);
        expect(results.filter((r) => r === "ok")).toHaveLength(1);
        expect(results.filter((r) => r === "reject")).toHaveLength(2);
        expect(reserved).toBe(10000);
        expect(available).toBe(0);
    });

    it("requestPayout recomputes available inside the transaction lock", async () => {
        const lock = new Mutex();
        let reserved = 0;
        const inserts: number[] = [];
        const tx = {
            $queryRaw: jest.fn().mockResolvedValue([{}]),
            $executeRaw: jest.fn(async (...args: unknown[]) => {
                const sql = String(args[0] || "");
                if (sql.includes("INSERT INTO") && sql.includes("Payout")) {
                    const amount = Number(args[3]);
                    inserts.push(amount);
                    reserved += amount;
                }
                return 1;
            }),
        };
        const prisma = {
            streamer: { findUnique: jest.fn().mockResolvedValue({ id: "st1", name: "Ada" }) },
            user: { findMany: jest.fn().mockResolvedValue([]) },
            $transaction: jest.fn((fn: (client: typeof tx) => unknown) => lock.run(() => fn(tx))),
            $queryRaw: jest.fn(async (strings: unknown) => {
                const sql = String(strings);
                if (sql.includes("invoiceCapable")) {
                    return [{ preferredPayoutMethod: "bank_transfer" }];
                }
                if (sql.includes("FROM") && sql.includes("Payout")) {
                    return [
                        {
                            id: "payout-row",
                            streamerId: "st1",
                            amount: reserved,
                            status: "pending",
                            streamerName: "Ada",
                            streamerEmail: "a@x.hu",
                        },
                    ];
                }
                return [];
            }),
            $executeRaw: jest.fn().mockResolvedValue(1),
        };
        compute.mockImplementation(async () => revenueStub(10000 - reserved));
        const svc = new PayoutsService(prisma as any, { payoutRequested: jest.fn() } as any);

        const results = await Promise.allSettled([
            svc.requestPayout({ streamerId: "st1", amount: 10000 }),
            svc.requestPayout({ streamerId: "st1", amount: 10000 }),
        ]);

        const ok = results.filter((r) => r.status === "fulfilled");
        const denied = results.filter((r) => r.status === "rejected");
        expect(ok).toHaveLength(1);
        expect(denied).toHaveLength(1);
        expect(denied[0].status === "rejected" && denied[0].reason).toBeInstanceOf(BadRequestException);
        expect(inserts).toEqual([10000]);
        expect(String(tx.$executeRaw.mock.calls[0][0])).toContain("pg_advisory_xact_lock");
    });
});

import { ForbiddenException, GoneException } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { privateShowIds } from "../private-streams/private-schema";

jest.mock("../private-streams/private-schema", () => ({
    privateShowIds: jest.fn(),
}));

const mockedPrivateIds = privateShowIds as jest.MockedFunction<typeof privateShowIds>;

function makeService() {
    const prisma = {
        ticket: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        show: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
        },
        streamer: { findUnique: jest.fn() },
    };
    const mail = { ticketPurchased: jest.fn() };
    const groups = { balance: jest.fn().mockResolvedValue({ balance: 0 }) };
    const svc = new TicketsService(prisma as any, mail as any, groups as any);
    return { svc, prisma, groups };
}

describe("phase D ticket category retirement", () => {
    beforeEach(() => {
        mockedPrivateIds.mockResolvedValue(new Set());
    });

    it("closes category show-ticket purchase with 410", () => {
        const { svc } = makeService();
        expect(() => svc.buy("u1", "show1", "vip")).toThrow(GoneException);
        expect((svc as { gift?: unknown }).gift).toBeUndefined();
    });

    it("sets canAsk from pack balance, not Ticket.category", async () => {
        const { svc, prisma, groups } = makeService();
        groups.balance.mockResolvedValue({ balance: 3 });
        prisma.ticket.findUnique.mockResolvedValue({
            id: "t1",
            userId: "u1",
            showId: "s1",
            status: "paid",
            price: 4000,
            category: { key: "nezo", name: "Néző jegy" },
            show: { id: "s1", title: "Show", startTime: new Date(), price: 0, live: true, streamId: "st" },
        });
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            extrasContent: "secret extras",
            privateStreamId: "vip-private",
        });

        const result = await svc.getForShow("u1", "s1");
        expect(result.access.questions).toBe(true);
        expect(result.access.extras).toBe(false);
        expect(result.access.privateStream).toBe(false);
        expect(result.access.live).toBe(true);
        expect(result.canAsk).toBe(true);
        expect(result.ticket?.canAsk).toBe(true);
        expect(result.extrasContent).toBeNull();
        expect(result.privateStreamId).toBeNull();
        expect(result.ticketBalance).toBe(3);
        expect(result.ticket).not.toHaveProperty("categoryKey");
        expect(result.ticket).not.toHaveProperty("categoryName");
    });

    it("does not grant extras from a leftover vip category", async () => {
        const { svc, prisma, groups } = makeService();
        groups.balance.mockResolvedValue({ balance: 0 });
        prisma.ticket.findUnique.mockResolvedValue({
            id: "t1",
            userId: "u1",
            showId: "s1",
            status: "active",
            price: 8000,
            category: { key: "vip", name: "VIP jegy" },
            show: { id: "s1", title: "Show" },
        });
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            extrasContent: "vip text",
            privateStreamId: "priv",
        });

        const result = await svc.getForShow("u1", "s1");
        expect(result.access.questions).toBe(false);
        expect(result.access.extras).toBe(false);
        expect(result.ticket?.canAsk).toBe(false);
    });

    it("keeps marketplace private-show access on paid ticket without category", async () => {
        const { svc, prisma, groups } = makeService();
        mockedPrivateIds.mockResolvedValue(new Set(["priv-show"]));
        groups.balance.mockResolvedValue({ balance: 5 });
        prisma.ticket.findUnique.mockResolvedValue({
            id: "t1",
            userId: "u1",
            showId: "priv-show",
            status: "active",
            price: 12000,
            category: null,
            show: { id: "priv-show" },
        });
        prisma.show.findUnique.mockResolvedValue({
            id: "priv-show",
            privateStreamId: "ps1",
            extrasContent: null,
        });

        const result = await svc.getForShow("u1", "priv-show");
        expect(result.access.live).toBe(true);
        expect(result.access.privateStream).toBe(true);
        expect(result.access.questions).toBe(false);
        expect(result.privateStreamId).toBe("ps1");
    });

    it("allows public live watch without a category ticket", async () => {
        const { svc, prisma } = makeService();
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamerId: null,
        });
        prisma.ticket.findUnique.mockResolvedValue(null);

        const result = await svc.assertCanWatch({ id: "u1" }, "st1", "s1", "live");
        expect(result.reason).toBe("public_watch");
    });

    it("rejects leftover vip extras/privateStream watch features", async () => {
        const { svc, prisma } = makeService();
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: "vip-st",
            streamerId: null,
        });
        prisma.ticket.findUnique.mockResolvedValue({
            id: "t1",
            status: "active",
            category: { key: "vip" },
        });

        await expect(svc.assertCanWatch({ id: "u1" }, "vip-st", "s1", "extras")).rejects.toBeInstanceOf(
            ForbiddenException,
        );
        await expect(svc.assertCanWatch({ id: "u1" }, "vip-st", "s1", "privateStream")).rejects.toBeInstanceOf(
            ForbiddenException,
        );
    });
});

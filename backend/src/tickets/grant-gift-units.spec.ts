import { BadRequestException } from "@nestjs/common";
import { TicketGroupsService } from "./ticket-groups.service";

function makeService() {
    const prisma = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest
            .fn()
            .mockResolvedValueOnce([{ balance: 4 }])
            .mockResolvedValueOnce([]),
    };
    const mail = { packPurchased: jest.fn().mockResolvedValue(undefined) };
    const svc = new TicketGroupsService(prisma as any, {} as any, mail as any);
    return { svc, prisma, mail };
}

describe("grantGiftUnits", () => {
    it("rejects empty userId", async () => {
        const { svc } = makeService();
        await expect(svc.grantGiftUnits({ userId: "  ", ticketCount: 1 })).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it("rejects ticketCount below 1", async () => {
        const { svc } = makeService();
        await expect(svc.grantGiftUnits({ userId: "u1", ticketCount: 0 })).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it("credits a paid gift pack and emails the viewer", async () => {
        const { svc, prisma, mail } = makeService();
        jest.spyOn(svc, "balance").mockResolvedValue({ balance: 4, lots: [] } as any);
        const result = await svc.grantGiftUnits({ userId: "u1", ticketCount: 3 });
        expect(result.ticketCount).toBe(3);
        expect(result.remainingCount).toBe(3);
        expect(result.source).toBe("gift");
        expect(result.groupKey).toBe("gift");
        expect(result.balance).toBe(4);
        expect(result.purchaseId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(prisma.$executeRaw).toHaveBeenCalled();
        expect(mail.packPurchased).toHaveBeenCalledWith("u1", "Ajándék kérdésjegy", 3, result.purchaseId);
    });
});

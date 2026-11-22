import { WatchedService } from "./watched.service";

describe("WatchedService", () => {
    const showId = "11111111-1111-4111-8111-111111111111";
    const userId = "22222222-2222-4222-8222-222222222222";

    it("rejects a missing show", async () => {
        const prisma = {
            $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
            show: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        const service = new WatchedService(prisma as any);
        await expect(service.add(userId, showId)).rejects.toThrow("A műsor nem található.");
    });

    it("records an existing show", async () => {
        const prisma = {
            $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
            $executeRaw: jest.fn().mockResolvedValue(undefined),
            show: { findUnique: jest.fn().mockResolvedValue({ id: showId }) },
        };
        const service = new WatchedService(prisma as any);
        await expect(service.add(userId, showId)).resolves.toEqual({ watched: true, showId });
        expect(prisma.$executeRaw).toHaveBeenCalled();
    });
});

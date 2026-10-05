import { StreamerApprovedGuard } from "./streamer-approved.guard";

describe("StreamerApprovedGuard", () => {
    it("accepts only the streamer bound to request.user.id", async () => {
        const prisma = {
            $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
            streamer: {
                findFirst: jest.fn().mockResolvedValue({
                    id: "s1",
                    userId: "u1",
                    status: "approved",
                }),
            },
        };
        const guard = new StreamerApprovedGuard(prisma as any);
        const req: { user: { id: string; email: string }; streamer?: unknown } = {
            user: { id: "u1", email: "other@example.com" },
        };
        const ctx = {
            switchToHttp: () => ({ getRequest: () => req }),
        };
        await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
        expect(prisma.streamer.findFirst).toHaveBeenCalledWith({ where: { userId: "u1" } });
    });
});

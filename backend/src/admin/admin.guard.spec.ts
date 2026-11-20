import { AdminGuard } from "./admin.guard";

describe("AdminGuard", () => {
    it("keeps username on request.user so POST admin actions pass the username gate", async () => {
        const prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue({
                    id: "u1",
                    email: "admin@example.com",
                    role: "admin",
                    username: "tesztadmin",
                }),
            },
        };
        const guard = new AdminGuard(prisma as any);
        const req = {
            user: {
                id: "u1",
                email: "admin@example.com",
                role: "admin",
                username: "tesztadmin",
                emailVerified: true,
            },
        };
        const ctx = {
            switchToHttp: () => ({ getRequest: () => req }),
        };

        await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
        expect(req.user.username).toBe("tesztadmin");
        expect(req.user.role).toBe("admin");
        expect(req.user.emailVerified).toBe(true);
    });
});

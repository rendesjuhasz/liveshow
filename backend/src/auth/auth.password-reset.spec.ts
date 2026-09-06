import { BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import {
    FORGOT_PASSWORD_MESSAGE,
    hashResetToken,
    RESET_TOKEN_INVALID_MESSAGE,
} from "./password-reset";

describe("AuthService password reset", () => {
    const prisma = {
        user: { findUnique: jest.fn() },
        $executeRaw: jest.fn(),
        $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn(),
    };
    const mail = { passwordReset: jest.fn(), registration: jest.fn() };
    const campaigns = { tryClaimFirstUsers: jest.fn() };
    const jwt = { sign: jest.fn().mockReturnValue("jwt-token") };
    let service: AuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AuthService(jwt as any, prisma as any, mail as any, campaigns as any);
    });

    it("does not reveal missing emails", async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        const res = await service.forgotPassword("nincs@example.com");
        expect(res.message).toBe(FORGOT_PASSWORD_MESSAGE);
        expect(mail.passwordReset).not.toHaveBeenCalled();
    });

    it("sends mail for an existing account", async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: "u1",
            email: "van@example.com",
            status: "active",
        });
        prisma.$executeRaw.mockResolvedValue(1);
        const res = await service.forgotPassword("van@example.com");
        expect(res.message).toBe(FORGOT_PASSWORD_MESSAGE);
        expect(mail.passwordReset).toHaveBeenCalledWith("van@example.com", expect.any(String));
    });

    it("rejects an invalid token", async () => {
        prisma.$queryRaw.mockResolvedValue([]);
        await expect(service.resetPassword("bad", "Teszt1234", "Teszt1234")).rejects.toThrow(
            RESET_TOKEN_INVALID_MESSAGE,
        );
    });

    it("rejects an expired token", async () => {
        prisma.$queryRaw.mockResolvedValue([
            {
                id: "u1",
                email: "van@example.com",
                role: "user",
                resetPasswordExpiresAt: new Date(Date.now() - 1000),
            },
        ]);
        await expect(service.resetPassword("token", "Teszt1234", "Teszt1234")).rejects.toThrow(
            RESET_TOKEN_INVALID_MESSAGE,
        );
    });

    it("resets password and issues a session", async () => {
        prisma.$queryRaw.mockResolvedValue([
            {
                id: "u1",
                email: "van@example.com",
                role: "user",
                resetPasswordExpiresAt: new Date(Date.now() + 60_000),
            },
        ]);
        prisma.$executeRaw.mockResolvedValue(1);
        const res = await service.resetPassword("good-token", "Teszt1234", "Teszt1234");
        expect(res.token).toBe("jwt-token");
        expect(res.user.email).toBe("van@example.com");
        expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it("rejects reuse after the hash is cleared", async () => {
        const token = "once";
        prisma.$queryRaw
            .mockResolvedValueOnce([
                {
                    id: "u1",
                    email: "van@example.com",
                    role: "user",
                    resetPasswordExpiresAt: new Date(Date.now() + 60_000),
                },
            ])
            .mockResolvedValueOnce([]);
        prisma.$executeRaw.mockResolvedValue(1);
        await service.resetPassword(token, "Teszt1234", "Teszt1234");
        await expect(service.resetPassword(token, "Masik1234", "Masik1234")).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(hashResetToken(token)).toHaveLength(64);
    });
});

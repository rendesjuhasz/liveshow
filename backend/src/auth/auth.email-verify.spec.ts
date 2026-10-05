import { BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { hashVerifyToken, RESEND_VERIFY_MESSAGE, VERIFY_TOKEN_INVALID_MESSAGE } from "./email-verify";

describe("AuthService email verification", () => {
    const prisma = {
        user: { findUnique: jest.fn(), create: jest.fn() },
        $executeRaw: jest.fn(),
        $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn(),
    };
    const mail = {
        passwordReset: jest.fn(),
        registration: jest.fn(),
        emailVerification: jest.fn(),
    };
    const campaigns = { tryClaimFirstUsers: jest.fn() };
    const jwt = { sign: jest.fn().mockReturnValue("jwt-token") };
    let service: AuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AuthService(jwt as any, prisma as any, mail as any, campaigns as any, {
            assignCode: jest.fn(),
            attachFromCode: jest.fn(),
        } as any);
    });

    it("rejects an invalid verify token", async () => {
        prisma.$queryRaw.mockResolvedValue([]);
        await expect(service.verifyEmail("bad-token-xx")).rejects.toThrow(VERIFY_TOKEN_INVALID_MESSAGE);
    });

    it("rejects an expired verify token", async () => {
        prisma.$queryRaw.mockResolvedValue([
            {
                id: "u1",
                email: "van@example.com",
                role: "user",
                name: "Van",
                emailVerifyExpiresAt: new Date(Date.now() - 1000),
            },
        ]);
        await expect(service.verifyEmail("token-token")).rejects.toThrow(VERIFY_TOKEN_INVALID_MESSAGE);
    });

    it("marks the account verified and issues a session", async () => {
        prisma.$queryRaw.mockResolvedValue([
            {
                id: "u1",
                email: "van@example.com",
                role: "user",
                name: "Van",
                emailVerifyExpiresAt: new Date(Date.now() + 60_000),
            },
        ]);
        prisma.$executeRaw.mockResolvedValue(1);
        const res = await service.verifyEmail("good-token-xx");
        expect(res.token).toBe("jwt-token");
        expect(res.user.email).toBe("van@example.com");
        expect(res.user.emailVerified).toBe(true);
        expect(hashVerifyToken("good-token-xx")).toHaveLength(64);
    });

    it("does not reveal missing emails on resend", async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        const res = await service.resendVerification(undefined, "nincs@example.com");
        expect(res.message).toBe(RESEND_VERIFY_MESSAGE);
        expect(mail.emailVerification).not.toHaveBeenCalled();
    });

    it("sends a new link for an unverified account", async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: "u1",
            email: "van@example.com",
            status: "active",
            locale: "hu",
        });
        prisma.$queryRaw.mockResolvedValue([{ emailVerified: false }]);
        prisma.$executeRaw.mockResolvedValue(1);
        const res = await service.resendVerification("u1");
        expect(res.message).toBe(RESEND_VERIFY_MESSAGE);
        expect(mail.emailVerification).toHaveBeenCalledWith("van@example.com", expect.any(String), "hu");
    });

    it("skips mail when already verified", async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: "u1",
            email: "van@example.com",
            status: "active",
        });
        prisma.$queryRaw.mockResolvedValue([{ emailVerified: true }]);
        const res = await service.resendVerification("u1");
        expect(res.message).toBe(RESEND_VERIFY_MESSAGE);
        expect(mail.emailVerification).not.toHaveBeenCalled();
    });

    it("rejects an empty token", async () => {
        await expect(service.verifyEmail("")).rejects.toBeInstanceOf(BadRequestException);
    });
});

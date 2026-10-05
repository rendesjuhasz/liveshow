import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    OnModuleInit,
    UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { GiftCampaignsService } from "../tickets/gift-campaigns.service";
import { ReferralService } from "../referrals/referral.service";
import { isStreamerCategory } from "../streamers/categories";
import { initialStreamerStatus } from "../streamers/status";
import { ensureStreamerPreflightColumns } from "../streamers/streamer-schema";
import { isBannedAccount } from "./account-status";
import { isAdminRole, normalizeRole, USER_ROLES } from "./roles";
import { hashSecret, newOpaqueToken } from "./secrets";
import {
    decryptTotpSecret,
    encryptTotpSecret,
    generateTotpSecret,
    otpauthUrl,
    verifyTotp,
} from "./totp";
import { assertValidEmail, assertValidPassword } from "../security/rate-limit";
import { sanitizeUserText } from "../security/sanitize-text";
import { ensureOAuthSchema } from "./oauth-schema";
import { publicFrontendUrl } from "./public-url";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import {
    createResetToken,
    FORGOT_PASSWORD_MESSAGE,
    hashResetToken,
    isResetExpired,
    RESET_TOKEN_INVALID_MESSAGE,
    resetExpiryDate,
} from "./password-reset";
import {
    createVerifyToken,
    hashVerifyToken,
    isVerifyExpired,
    RESEND_VERIFY_MESSAGE,
    VERIFY_TOKEN_INVALID_MESSAGE,
    verifyExpiryDate,
} from "./email-verify";


export type StreamerRegisterInput = {
    name: string;
    email: string;
    password: string;
    bio: string;
    category: string;
    contactEmail: string;
    termsAccepted: boolean;
    avatarUrl: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
    constructor(
        private jwt: JwtService,
        private prisma: PrismaService,
        private readonly mail: MailService,
        private readonly campaigns: GiftCampaignsService,
        private readonly referrals: ReferralService,
    ) {}

    async onModuleInit() {
        await this.ensurePasswordResetColumns();
        await this.ensureEmailVerifyColumns();
        await this.ensureUserNameColumn();
        await this.ensureAuthSecurityColumns();
        await ensureStreamerPreflightColumns(this.prisma);
        await ensureOAuthSchema(this.prisma);
    }

    async sessionForUserId(userId: string) {
        const found = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { streamer: true },
        });
        if (!found) throw new UnauthorizedException("A felhasználó nem található.");
        if (isBannedAccount(found.status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }
        const emailVerified = await this.readEmailVerified(found.id);
        const totpEnabled = await this.readTotpEnabled(found.id);
        return this.session({ ...found, emailVerified, totpEnabled });
    }

    private displayName(row: { name?: string | null; email: string; streamer?: { name?: string | null } | null }) {
        return String(row.name || row.streamer?.name || "").trim() || null;
    }

    private streamerSummary(row: {
        streamer?: { id?: string; name?: string | null; status?: string | null } | null;
    }) {
        const s = row.streamer;
        if (!s?.id) return null;
        return {
            id: String(s.id),
            name: String(s.name || ""),
            status: String(s.status || ""),
        };
    }

    private accountRole(row: {
        role?: string | null;
        isAdmin?: boolean;
        streamer?: { id?: string } | null;
    }) {
        if (isAdminRole(row)) return USER_ROLES.ADMIN;
        if (row.streamer?.id || normalizeRole(row.role) === USER_ROLES.STREAMER) {
            return USER_ROLES.STREAMER;
        }
        return normalizeRole(row.role);
    }

    private toUser(row: {
        id: string;
        email: string;
        role?: string | null;
        name?: string | null;
        locale?: string | null;
        timezone?: string | null;
        emailVerified?: boolean | null;
        totpEnabled?: boolean | null;
        streamer?: { id?: string; name?: string | null; status?: string | null } | null;
    }) {
        return {
            id: row.id,
            email: row.email,
            name: this.displayName(row),
            role: this.accountRole(row),
            locale: row.locale || "hu",
            timezone: (row as { timezone?: string | null }).timezone || null,
            emailVerified: row.emailVerified !== false,
            isAdmin: isAdminRole(row),
            totpEnabled: Boolean(row.totpEnabled),
            streamer: this.streamerSummary(row),
        };
    }

    private signToken(
        user: {
            id: string;
            email: string;
            role: string;
            name?: string | null;
            emailVerified?: boolean;
        },
        expiresIn: "1h" | "15m" = "1h",
    ) {
        return this.jwt.sign(
            {
                sub: user.id,
                email: user.email,
                name: user.name || undefined,
                role: user.role,
                emailVerified: user.emailVerified !== false,
            },
            { expiresIn },
        );
    }

    private async session(row: {
        id: string;
        email: string;
        role?: string | null;
        name?: string | null;
        emailVerified?: boolean | null;
        totpEnabled?: boolean | null;
        streamer?: { id?: string; name?: string | null; status?: string | null } | null;
    }) {
        if (row.streamer?.id && !isAdminRole(row) && normalizeRole(row.role) !== USER_ROLES.STREAMER) {
            await this.prisma.$executeRaw`
                UPDATE "User" SET role = ${USER_ROLES.STREAMER}, "updatedAt" = NOW() WHERE id = ${row.id}
            `.catch(() => undefined);
            row.role = USER_ROLES.STREAMER;
        }
        const user = this.toUser(row);
        const token = this.signToken(user);
        const refreshToken = await this.issueRefreshToken(row.id);
        const csrfToken = newOpaqueToken();
        return {
            token,
            refreshToken,
            csrfToken,
            expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
            user,
        };
    }

    async register(email: string, password: string, name?: string, referralCode?: string, locale?: string) {
        if (!email?.trim() || !password) {
            throw new BadRequestException("Email és jelszó kötelező.");
        }
        const fullName = sanitizeUserText(name, 120);
        if (!fullName) {
            throw new BadRequestException("A név kötelező.");
        }
        const normalized = email.trim().toLowerCase();
        assertValidEmail(normalized);
        assertValidPassword(password);

        const existing = await this.prisma.user.findUnique({
            where: { email: normalized },
        });

        if (existing) {
            throw new ConflictException("Ez az email már létezik.");
        }

        const hashed = await bcrypt.hash(password, 10);

        const created = await this.prisma.user.create({
            data: {
                email: normalized,
                name: fullName,
                password: hashed,
                role: USER_ROLES.USER,
                locale: String(locale || "hu").slice(0, 5) || "hu",
                provider: "local",
            },
        });
        await this.setEmailVerifiedFlag(created.id, false);

        await this.sendRegistrationVerifyMail({ ...created, emailVerified: false }, false);
        void this.campaigns.tryClaimFirstUsers(created.id);
        await this.referrals.assignCode(created.id);
        await this.referrals.attachFromCode(created.id, referralCode);
        return this.session({ ...created, emailVerified: false });
    }

    async registerStreamer(input: StreamerRegisterInput) {
        const name = sanitizeUserText(input.name, 120);
        const email = String(input.email || "").trim().toLowerCase();
        const password = String(input.password || "");
        const bio = sanitizeUserText(input.bio, 4000);
        const category = String(input.category || "").trim().toLowerCase();
        const contactEmail = String(input.contactEmail || "").trim().toLowerCase();

        if (!name) throw new BadRequestException("A teljes név kötelező.");
        if (!email) throw new BadRequestException("Az email kötelező.");
        assertValidEmail(email);
        assertValidPassword(password);
        if (!bio) throw new BadRequestException("A bemutatkozás kötelező.");
        assertNoOffPlatformContact(bio, name);
        if (!isStreamerCategory(category)) {
            throw new BadRequestException("Érvénytelen kategória.");
        }
        if (!contactEmail) {
            throw new BadRequestException("A kapcsolattartási email kötelező.");
        }
        if (!input.termsAccepted) {
            throw new BadRequestException("A Tartalomkészítő ÁSZF elfogadása kötelező.");
        }
        if (!input.avatarUrl) {
            throw new BadRequestException("A profilkép kötelező.");
        }

        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ConflictException(
                "Ez az email már regisztrálva van. Jelentkezz be, vagy használj másik címet.",
            );
        }

        const existingStreamer = await this.prisma.streamer.findUnique({ where: { email } });
        if (existingStreamer) {
            throw new ConflictException("Ehhez az emailhez már tartozik tartalomkészítő profil.");
        }

        const hashed = await bcrypt.hash(password, 10);

        const created = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    name,
                    password: hashed,
                    role: USER_ROLES.STREAMER,
                },
            });

            const streamer = await tx.streamer.create({
                data: {
                    name,
                    email,
                    bio,
                    avatarUrl: input.avatarUrl,
                    category,
                    contactEmail,
                    termsAcceptedAt: new Date(),
                    userId: user.id,
                    status: initialStreamerStatus(),
                },
            });

            return { user, streamer };
        });
        const verified = process.env.NODE_ENV !== "production";
        await this.setEmailVerifiedFlag(created.user.id, verified);

        await this.sendRegistrationVerifyMail({ ...created.user, emailVerified: verified }, true);
        void this.campaigns.tryClaimFirstUsers(created.user.id);
        await this.referrals.assignCode(created.user.id);
        const session = await this.session({ ...created.user, emailVerified: verified });
        return {
            ...session,
            streamer: created.streamer,
        };
    }

    async login(email: string, password: string) {
        if (!email?.trim() || !password) {
            throw new BadRequestException("Email és jelszó kötelező.");
        }

        const normalized = email.trim().toLowerCase();
        assertValidEmail(normalized);

        const found = await this.prisma.user.findUnique({
            where: { email: normalized },
            include: { streamer: true },
        });

        if (!found) {
            throw new UnauthorizedException("Hibás email vagy jelszó.");
        }

        if (!found.streamer) {
            const byEmail = await this.prisma.streamer.findFirst({ where: { email: normalized } });
            if (byEmail && (!byEmail.userId || byEmail.userId === found.id)) {
                if (!byEmail.userId) {
                    await this.prisma.streamer.update({
                        where: { id: byEmail.id },
                        data: { userId: found.id },
                    });
                }
                found.streamer = byEmail;
            }
        }

        const lockedUntil = (found as { lockedUntil?: Date | null }).lockedUntil;
        if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
            throw new HttpException(
                "Túl sok hibás belépés. Próbáld újra 15 perc múlva.",
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        if (!found.password) {
            throw new UnauthorizedException(
                "Ehhez a fiókhoz Google, Microsoft vagy Apple belépés kell, vagy kérj jelszó-helyreállítást.",
            );
        }

        const ok = await bcrypt.compare(password, found.password);
        if (!ok) {
            await this.recordFailedLogin(found.id, Number((found as { failedLoginCount?: number }).failedLoginCount || 0));
            throw new UnauthorizedException("Hibás email vagy jelszó.");
        }

        if (isBannedAccount((found as { status?: string }).status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }

        if (process.env.NODE_ENV !== "production" && found.streamer) {
            await this.setEmailVerifiedFlag(found.id, true);
        }

        const emailVerified = await this.readEmailVerified(found.id);
        const totpEnabled = await this.readTotpEnabled(found.id);
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "lastLoginAt" = NOW(),
                "lastLoginProvider" = 'local',
                provider = 'local',
                "updatedAt" = NOW()
            WHERE id = ${found.id}
        `.catch(() => undefined);
        await this.prisma.$executeRaw`
            INSERT INTO "AuthEvent" (id, "userId", action, provider, "createdAt")
            VALUES (${randomUUID()}, ${found.id}, ${"login"}, ${"local"}, NOW())
        `.catch(() => undefined);
        return this.session({ ...found, emailVerified, totpEnabled });
    }

    async forgotPassword(email?: string) {
        const normalized = String(email || "").trim().toLowerCase();
        if (normalized) {
            try {
                assertValidEmail(normalized);
            } catch {
                return { message: FORGOT_PASSWORD_MESSAGE };
            }

            const found = await this.prisma.user.findUnique({
                where: { email: normalized },
            });
            if (found && !isBannedAccount((found as { status?: string }).status)) {
                const raw = createResetToken();
                const hash = hashResetToken(raw);
                const expires = resetExpiryDate();
                await this.prisma.$executeRaw`
                    UPDATE "User"
                    SET "resetPasswordTokenHash" = ${hash},
                        "resetPasswordExpiresAt" = ${expires},
                        "updatedAt" = NOW()
                    WHERE id = ${found.id}
                `;
                void this.mail.passwordReset(found.email, raw, (found as { locale?: string }).locale || "hu");
            }
        }
        return { message: FORGOT_PASSWORD_MESSAGE };
    }

    async resetPassword(token?: string, password?: string, passwordConfirm?: string) {
        const raw = String(token || "").trim();
        if (!raw) {
            throw new BadRequestException(RESET_TOKEN_INVALID_MESSAGE);
        }
        if (passwordConfirm !== undefined && password !== passwordConfirm) {
            throw new BadRequestException("A két jelszó nem egyezik.");
        }
        assertValidPassword(String(password || ""));

        const hash = hashResetToken(raw);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, email, role, "resetPasswordExpiresAt"
            FROM "User"
            WHERE "resetPasswordTokenHash" = ${hash}
            LIMIT 1
        `;
        const found = rows[0];
        if (!found || isResetExpired(found.resetPasswordExpiresAt)) {
            throw new BadRequestException(RESET_TOKEN_INVALID_MESSAGE);
        }

        const hashed = await bcrypt.hash(String(password), 10);
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET password = ${hashed},
                "resetPasswordTokenHash" = NULL,
                "resetPasswordExpiresAt" = NULL,
                "emailVerified" = TRUE,
                "emailVerifyTokenHash" = NULL,
                "emailVerifyExpiresAt" = NULL,
                "updatedAt" = NOW()
            WHERE id = ${found.id}
        `;

        return this.session({
            id: found.id,
            email: found.email,
            role: found.role,
        });
    }

    async updateProfile(userId: string, body: { name?: string; locale?: string; timezone?: string }) {
        const fullName = body.name !== undefined ? sanitizeUserText(body.name, 120) : undefined;
        if (fullName !== undefined && !fullName) {
            throw new BadRequestException("A név kötelező.");
        }
        const data: { name?: string; locale?: string; timezone?: string } = {};
        if (fullName) data.name = fullName;
        if (body.locale) data.locale = String(body.locale).slice(0, 5);
        if (body.timezone) {
            const { assertIanaTimeZone } = await import("../time/timezone");
            data.timezone = assertIanaTimeZone(body.timezone);
        }
        if (!Object.keys(data).length) {
            throw new BadRequestException("Nincs módosítható mező.");
        }
        try {
            const updated = await this.prisma.user.update({
                where: { id: userId },
                data,
                include: { streamer: true },
            });
            if (updated.streamer && data.name) {
                await this.prisma.streamer.update({
                    where: { id: updated.streamer.id },
                    data: { name: data.name },
                });
            }
        } catch {
            if (data.timezone) {
                await this.prisma.$executeRaw`
                    UPDATE "User" SET timezone = ${data.timezone} WHERE id = ${userId}
                `.catch(() => undefined);
            }
            if (data.locale || data.name) {
                await this.prisma.user.update({
                    where: { id: userId },
                    data: { ...(data.name ? { name: data.name } : {}), ...(data.locale ? { locale: data.locale } : {}) },
                });
            }
        }
        return this.getMe(userId);
    }

    private async ensureUserNameColumn() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'hu'`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(`
            UPDATE "User" AS u
            SET name = s.name
            FROM "Streamer" AS s
            WHERE s."userId" = u.id
              AND (u.name IS NULL OR btrim(u.name) = '')
        `).catch(() => undefined);
    }

    private async ensurePasswordResetColumns() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordTokenHash" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordExpiresAt" TIMESTAMP(3)`,
        ).catch(() => undefined);
    }

    private async ensureEmailVerifyColumns() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT true`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyTokenHash" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpiresAt" TIMESTAMP(3)`,
        ).catch(() => undefined);
    }

    private async readEmailVerified(userId: string) {
        const rows = await this.prisma.$queryRaw<{ emailVerified?: boolean | null }[]>`
            SELECT "emailVerified" FROM "User" WHERE id = ${userId} LIMIT 1
        `.catch(() => [] as { emailVerified?: boolean | null }[]);
        const value = rows[0]?.emailVerified;
        if (value === false) return false;
        return true;
    }

    private async setEmailVerifiedFlag(userId: string, verified: boolean) {
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "emailVerified" = ${verified},
                "updatedAt" = NOW()
            WHERE id = ${userId}
        `.catch(() => undefined);
    }

    private verifyLink(rawToken: string) {
        const base = publicFrontendUrl();
        return `${base}/verify-email?token=${encodeURIComponent(rawToken)}`;
    }

    private async storeVerifyToken(userId: string) {
        const raw = createVerifyToken();
        const hash = hashVerifyToken(raw);
        const expires = verifyExpiryDate();
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "emailVerifyTokenHash" = ${hash},
                "emailVerifyExpiresAt" = ${expires},
                "updatedAt" = NOW()
            WHERE id = ${userId}
        `;
        return raw;
    }

    private async sendRegistrationVerifyMail(
        user: { id: string; email: string; locale?: string | null; emailVerified?: boolean | null },
        isStreamer: boolean,
    ) {
        const locale = user.locale || "hu";
        if (user.emailVerified) {
            void this.mail.registration(user.email, isStreamer, locale);
            return;
        }
        const raw = await this.storeVerifyToken(user.id);
        void this.mail.registration(user.email, isStreamer, locale, this.verifyLink(raw));
    }

    async verifyEmail(token?: string) {
        const raw = String(token || "").trim();
        if (!raw) {
            throw new BadRequestException(VERIFY_TOKEN_INVALID_MESSAGE);
        }
        const hash = hashVerifyToken(raw);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, email, role, name, "emailVerifyExpiresAt"
            FROM "User"
            WHERE "emailVerifyTokenHash" = ${hash}
            LIMIT 1
        `;
        const found = rows[0];
        if (!found || isVerifyExpired(found.emailVerifyExpiresAt)) {
            throw new BadRequestException(VERIFY_TOKEN_INVALID_MESSAGE);
        }
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "emailVerified" = TRUE,
                "emailVerifyTokenHash" = NULL,
                "emailVerifyExpiresAt" = NULL,
                "updatedAt" = NOW()
            WHERE id = ${found.id}
        `;
        return this.session({
            id: found.id,
            email: found.email,
            role: found.role,
            name: found.name,
            emailVerified: true,
        });
    }

    async resendVerification(userId?: string, email?: string) {
        let found: {
            id: string;
            email: string;
            locale?: string | null;
            emailVerified?: boolean | null;
            status?: string | null;
        } | null = null;
        if (userId) {
            found = await this.prisma.user.findUnique({ where: { id: userId } });
        } else {
            const normalized = String(email || "").trim().toLowerCase();
            if (normalized) {
                try {
                    assertValidEmail(normalized);
                    found = await this.prisma.user.findUnique({ where: { email: normalized } });
                } catch {
                    found = null;
                }
            }
        }
        if (found && !isBannedAccount(found.status)) {
            const verified = await this.readEmailVerified(found.id);
            if (!verified) {
                const raw = await this.storeVerifyToken(found.id);
                void this.mail.emailVerification(found.email, raw, found.locale || "hu");
            }
        }
        return { message: RESEND_VERIFY_MESSAGE };
    }

    private async ensureAuthSecurityColumns() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3)`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3)`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecretEnc" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpPendingEnc" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpConfirmedAt" TIMESTAMP(3)`,
        ).catch(() => undefined);
    }

    private async readTotpEnabled(userId: string) {
        const rows = await this.prisma.$queryRaw<{ totpEnabled?: boolean | null }[]>`
            SELECT "totpEnabled" FROM "User" WHERE id = ${userId} LIMIT 1
        `.catch(() => [] as { totpEnabled?: boolean | null }[]);
        return rows[0]?.totpEnabled === true;
    }

    async totpStatus(userId: string) {
        return { enabled: await this.readTotpEnabled(userId), required: false };
    }

    async totpSetup(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException("A felhasználó nem található.");
        const secret = generateTotpSecret();
        const enc = encryptTotpSecret(secret);
        await this.prisma.$executeRaw`
            UPDATE "User" SET "totpPendingEnc" = ${enc}, "updatedAt" = NOW() WHERE id = ${userId}
        `;
        return {
            secret,
            otpauthUrl: otpauthUrl(user.email, secret),
            enabled: false,
            required: false,
        };
    }

    async totpConfirm(userId: string, code: string) {
        const rows = await this.prisma.$queryRaw<{ totpPendingEnc?: string | null }[]>`
            SELECT "totpPendingEnc" FROM "User" WHERE id = ${userId} LIMIT 1
        `;
        const pending = rows[0]?.totpPendingEnc;
        if (!pending) throw new BadRequestException("Előbb indítsd a 2FA beállítást.");
        const secret = decryptTotpSecret(pending);
        if (!verifyTotp(secret, code)) {
            throw new BadRequestException("Érvénytelen hitelesítő kód.");
        }
        const enc = encryptTotpSecret(secret);
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "totpSecretEnc" = ${enc},
                "totpPendingEnc" = NULL,
                "totpEnabled" = true,
                "totpConfirmedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = ${userId}
        `;
        return { enabled: true, required: false };
    }

    async totpDisable(userId: string, password: string, code: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException("A felhasználó nem található.");
        const ok = await bcrypt.compare(String(password || ""), user.password || "");
        if (!ok) throw new UnauthorizedException("Hibás jelszó.");
        const rows = await this.prisma.$queryRaw<{ totpSecretEnc?: string | null; totpEnabled?: boolean | null }[]>`
            SELECT "totpSecretEnc", "totpEnabled" FROM "User" WHERE id = ${userId} LIMIT 1
        `;
        if (rows[0]?.totpEnabled && rows[0]?.totpSecretEnc) {
            const secret = decryptTotpSecret(rows[0].totpSecretEnc);
            if (!verifyTotp(secret, code)) {
                throw new BadRequestException("Érvénytelen hitelesítő kód.");
            }
        }
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "totpEnabled" = false,
                "totpSecretEnc" = NULL,
                "totpPendingEnc" = NULL,
                "totpConfirmedAt" = NULL,
                "updatedAt" = NOW()
            WHERE id = ${userId}
        `;
        return { enabled: false, required: false };
    }

    private async recordFailedLogin(userId: string, current: number) {
        const next = current + 1;
        const lockedUntil = next >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "failedLoginCount" = ${next},
                "lockedUntil" = ${lockedUntil},
                "updatedAt" = NOW()
            WHERE id = ${userId}
        `.catch(() => undefined);
    }

    private async issueRefreshToken(userId: string) {
        const raw = newOpaqueToken();
        const hash = hashSecret(raw);
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "refreshTokenHash" = ${hash},
                "refreshTokenExpiresAt" = ${expires},
                "failedLoginCount" = 0,
                "lockedUntil" = NULL,
                "updatedAt" = NOW()
            WHERE id = ${userId}
        `;
        return raw;
    }

    async refreshSession(refreshToken?: string) {
        const raw = String(refreshToken || "").trim();
        if (!raw) throw new UnauthorizedException("Érvénytelen munkamenet.");
        const hash = hashSecret(raw);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, email, role, name, status, "emailVerified", "refreshTokenExpiresAt"
            FROM "User"
            WHERE "refreshTokenHash" = ${hash}
            LIMIT 1
        `;
        const found = rows[0];
        if (!found || !found.refreshTokenExpiresAt || new Date(found.refreshTokenExpiresAt).getTime() <= Date.now()) {
            throw new UnauthorizedException("A belépés lejárt. Jelentkezz be újra.");
        }
        if (isBannedAccount(found.status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }
        return this.session(found);
    }

    async logoutRefresh(refreshToken?: string) {
        const raw = String(refreshToken || "").trim();
        if (!raw) return { ok: true };
        const hash = hashSecret(raw);
        await this.prisma.$executeRaw`
            UPDATE "User"
            SET "refreshTokenHash" = NULL,
                "refreshTokenExpiresAt" = NULL,
                "updatedAt" = NOW()
            WHERE "refreshTokenHash" = ${hash}
        `.catch(() => undefined);
        return { ok: true };
    }

    async issueWsTicket(userId: string) {
        const me = await this.getMe(userId);
        return {
            token: this.signToken(
                {
                    id: me.id,
                    email: me.email,
                    role: me.role,
                    name: me.name,
                    emailVerified: me.emailVerified,
                },
                "15m",
            ),
        };
    }

    async getMe(userId: string) {
        if (!userId) {
            throw new UnauthorizedException("Érvénytelen token.");
        }

        const found = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                streamer: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                        avatarUrl: true,
                        status: true,
                    },
                },
                badges: { orderBy: { createdAt: "desc" } },
            },
        });

        if (!found) {
            throw new UnauthorizedException("A felhasználó nem található.");
        }

        if (isBannedAccount((found as { status?: string }).status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }

        return {
            ...this.toUser({
                ...found,
                emailVerified: await this.readEmailVerified(found.id),
                totpEnabled: await this.readTotpEnabled(found.id),
            }),
            xp: found.xp ?? 0,
            badges: (found.badges || []).map((b) => ({
                id: b.id,
                key: b.key,
                title: b.title,
                description: b.description,
                createdAt: b.createdAt,
            })),
            streamer: found.streamer
                ? {
                      id: found.streamer.id,
                      name: found.streamer.name,
                      category: found.streamer.category,
                      avatarUrl: found.streamer.avatarUrl,
                      status: found.streamer.status,
                  }
                : null,
        };
    }
}

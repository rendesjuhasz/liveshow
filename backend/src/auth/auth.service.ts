import {
    BadRequestException,
    ConflictException,
    Injectable,
    OnModuleInit,
    UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { GiftCampaignsService } from "../tickets/gift-campaigns.service";
import { ReferralService } from "../referrals/referral.service";
import { isStreamerCategory } from "../streamers/categories";
import { isBannedAccount } from "./account-status";
import { isAdminRole, normalizeRole, roleForEmail, USER_ROLES } from "./roles";
import { assertValidEmail, assertValidPassword } from "../security/rate-limit";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import {
    createResetToken,
    FORGOT_PASSWORD_MESSAGE,
    hashResetToken,
    isResetExpired,
    RESET_TOKEN_INVALID_MESSAGE,
    resetExpiryDate,
} from "./password-reset";


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
        await this.ensureUserNameColumn();
    }

    private displayName(row: { name?: string | null; email: string; streamer?: { name?: string | null } | null }) {
        return String(row.name || row.streamer?.name || "").trim() || null;
    }

    private toUser(row: {
        id: string;
        email: string;
        role?: string | null;
        name?: string | null;
        locale?: string | null;
        streamer?: { name?: string | null } | null;
    }) {
        return {
            id: row.id,
            email: row.email,
            name: this.displayName(row),
            role: normalizeRole(row.role),
            locale: row.locale || "hu",
        };
    }

    private signToken(user: { id: string; email: string; role: string; name?: string | null }) {
        return this.jwt.sign({
            sub: user.id,
            email: user.email,
            name: user.name || undefined,
            role: user.role,
        });
    }

    private session(row: { id: string; email: string; role?: string | null; name?: string | null; streamer?: { name?: string | null } | null }) {
        const user = this.toUser(row);
        return {
            token: this.signToken(user),
            user,
        };
    }

    async register(email: string, password: string, name?: string, referralCode?: string, locale?: string) {
        if (!email?.trim() || !password) {
            throw new BadRequestException("Email és jelszó kötelező.");
        }
        const fullName = String(name || "").trim();
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
        const role = roleForEmail(normalized);

        const created = await this.prisma.user.create({
            data: {
                email: normalized,
                name: fullName,
                password: hashed,
                role,
                locale: String(locale || "hu").slice(0, 5) || "hu",
            },
        });

        void this.mail.registration(created.email, false, (created as { locale?: string }).locale);
        void this.campaigns.tryClaimFirstUsers(created.id);
        await this.referrals.assignCode(created.id);
        await this.referrals.attachFromCode(created.id, referralCode);
        return this.session(created);
    }

    async registerStreamer(input: StreamerRegisterInput) {
        const name = String(input.name || "").trim();
        const email = String(input.email || "").trim().toLowerCase();
        const password = String(input.password || "");
        const bio = String(input.bio || "").trim();
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
            throw new BadRequestException("A Streamer ÁSZF elfogadása kötelező.");
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
            throw new ConflictException("Ehhez az emailhez már tartozik streamer profil.");
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
                    status: "pending",
                },
            });

            return { user, streamer };
        });

        void this.mail.registration(created.user.email, true);
        void this.campaigns.tryClaimFirstUsers(created.user.id);
        await this.referrals.assignCode(created.user.id);
        return {
            ...this.session(created.user),
            streamer: created.streamer,
        };
    }

    async login(email: string, password: string) {
        await this.ensureUserNameColumn();
        await this.ensurePasswordResetColumns();
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

        const ok = await bcrypt.compare(password, found.password);
        if (!ok) {
            throw new UnauthorizedException("Hibás email vagy jelszó.");
        }

        if (isBannedAccount((found as { status?: string }).status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }

        if (isAdminRole(found) && normalizeRole(found.role) !== USER_ROLES.ADMIN) {
            await this.prisma.user.update({
                where: { id: found.id },
                data: { role: USER_ROLES.ADMIN },
            });
            found.role = USER_ROLES.ADMIN;
        }

        return this.session(found);
    }

    async forgotPassword(email?: string) {
        await this.ensurePasswordResetColumns();
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
        await this.ensurePasswordResetColumns();
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
                "updatedAt" = NOW()
            WHERE id = ${found.id}
        `;

        return this.session({
            id: found.id,
            email: found.email,
            role: found.role,
        });
    }

    async updateProfile(userId: string, body: { name?: string; locale?: string }) {
        await this.ensureUserNameColumn();
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'hu'`,
        ).catch(() => undefined);
        const fullName = body.name !== undefined ? String(body.name || "").trim() : undefined;
        if (fullName !== undefined && !fullName) {
            throw new BadRequestException("A név kötelező.");
        }
        const data: { name?: string; locale?: string } = {};
        if (fullName) data.name = fullName;
        if (body.locale) data.locale = String(body.locale).slice(0, 5);
        if (!Object.keys(data).length) {
            throw new BadRequestException("A név kötelező.");
        }
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
        return this.getMe(userId);
    }

    private async ensureUserNameColumn() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT`,
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

    async getMe(userId: string) {
        if (!userId) {
            throw new UnauthorizedException("Érvénytelen token.");
        }

        const found = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { streamer: true, badges: { orderBy: { createdAt: "desc" } } },
        });

        if (!found) {
            throw new UnauthorizedException("A felhasználó nem található.");
        }

        if (isBannedAccount((found as { status?: string }).status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }

        return {
            ...this.toUser(found),
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

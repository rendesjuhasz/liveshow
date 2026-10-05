import {
    BadRequestException,
    Injectable,
    OnModuleInit,
    UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { GiftCampaignsService } from "../tickets/gift-campaigns.service";
import { ReferralService } from "../referrals/referral.service";
import { USER_ROLES } from "./roles";
import { isBannedAccount } from "./account-status";
import { AuthService } from "./auth.service";
import { sanitizeUserText } from "../security/sanitize-text";
import { assertValidEmail } from "../security/rate-limit";
import {
    decideOAuthLink,
    providerIdField,
    safeAvatarUrl,
    type OAuthProvider,
} from "./oauth-link";
import {
    authorizationUrl,
    fetchOAuthProfile,
    googleConfigured,
    microsoftConfigured,
    appleConfigured,
    newOAuthNonce,
    providerConfigured,
} from "./oauth-providers";
import { createOAuthState, readOAuthState, safeOAuthNextPath } from "./oauth-state";
import { ensureOAuthSchema } from "./oauth-schema";

@Injectable()
export class OAuthService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthService,
        private readonly campaigns: GiftCampaignsService,
        private readonly referrals: ReferralService,
    ) {}

    async onModuleInit() {
        await ensureOAuthSchema(this.prisma);
    }

    configured() {
        return {
            google: googleConfigured(),
            microsoft: microsoftConfigured(),
            apple: appleConfigured(),
        };
    }

    startUrl(provider: OAuthProvider, nextPath?: string) {
        if (!providerConfigured(provider)) {
            throw new BadRequestException("Ez a belépési mód nincs beállítva a szerveren.");
        }
        const state = createOAuthState(provider, safeOAuthNextPath(nextPath), newOAuthNonce());
        return authorizationUrl(provider, state);
    }

    async finish(
        provider: OAuthProvider,
        query: { code?: string; state?: string; error?: string; user?: string },
    ) {
        if (query.error) {
            throw new UnauthorizedException("A belépés meg lett szakítva.");
        }
        const code = String(query.code || "").trim();
        if (!code) throw new BadRequestException("Hiányzó engedélykód.");
        const state = readOAuthState(query.state, provider);
        const profile = await fetchOAuthProfile(provider, code, query.user);
        if (!profile.providerUserId) {
            throw new UnauthorizedException("A szolgáltató nem adott felhasználóazonosítót.");
        }
        const userId = await this.upsertUser(provider, profile);
        const session = await this.auth.sessionForUserId(userId);
        return { session, next: state.next || "/" };
    }

    private async findByProviderId(field: "googleId" | "microsoftId" | "appleId", providerUserId: string) {
        if (field === "googleId") {
            return this.prisma.$queryRaw<{ id: string; status: string | null }[]>`
                SELECT id, status FROM "User" WHERE "googleId" = ${providerUserId} LIMIT 1
            `;
        }
        if (field === "microsoftId") {
            return this.prisma.$queryRaw<{ id: string; status: string | null }[]>`
                SELECT id, status FROM "User" WHERE "microsoftId" = ${providerUserId} LIMIT 1
            `;
        }
        return this.prisma.$queryRaw<{ id: string; status: string | null }[]>`
            SELECT id, status FROM "User" WHERE "appleId" = ${providerUserId} LIMIT 1
        `;
    }

    private async upsertUser(
        provider: OAuthProvider,
        profile: {
            providerUserId: string;
            email: string | null;
            emailVerified: boolean;
            name: string | null;
            avatarUrl: string | null;
        },
    ) {
        const field = providerIdField(provider);
        const byId = (await this.findByProviderId(field, profile.providerUserId))[0] || null;
        const email = profile.email ? String(profile.email).trim().toLowerCase() : null;
        if (email) assertValidEmail(email);
        const byEmailRows = email
            ? await this.prisma.$queryRaw<any[]>`
                SELECT id, status, "googleId", "microsoftId", "appleId"
                FROM "User" WHERE email = ${email} LIMIT 1
              `
            : [];
        const byEmail = byEmailRows[0] || null;
        const decision = decideOAuthLink({
            providerUserId: profile.providerUserId,
            email,
            emailVerified: Boolean(profile.emailVerified && email),
            existingByProviderId: byId,
            existingByEmail: byEmail
                ? { id: byEmail.id, boundProviderId: byEmail[field] || null }
                : null,
        });

        if (decision.action === "conflict") {
            if (!email) {
                throw new BadRequestException(
                    "Az Apple nem küldött e-mail címet. Lépj be ugyanazzal az Apple ID-val, amivel korábban.",
                );
            }
            throw new UnauthorizedException("A szolgáltató e-mail címe nem használható.");
        }

        const name = sanitizeUserText(profile.name, 120) || null;
        const avatarUrl = safeAvatarUrl(profile.avatarUrl);
        const display = name || (email ? email.split("@")[0] : "Néző");

        if (decision.action === "create") {
            const id = randomUUID();
            await this.prisma.$executeRaw`
                INSERT INTO "User"
                    (id, email, name, password, role, status, provider, "googleId", "microsoftId", "appleId",
                     "emailVerified", "avatarUrl", "lastLoginAt", "lastLoginProvider", "createdAt", "updatedAt")
                VALUES (
                    ${id},
                    ${email as string},
                    ${display},
                    NULL,
                    ${USER_ROLES.USER},
                    'active',
                    ${provider},
                    ${field === "googleId" ? profile.providerUserId : null},
                    ${field === "microsoftId" ? profile.providerUserId : null},
                    ${field === "appleId" ? profile.providerUserId : null},
                    TRUE,
                    ${avatarUrl},
                    NOW(),
                    ${provider},
                    NOW(),
                    NOW()
                )
            `;
            void this.campaigns.tryClaimFirstUsers(id);
            await this.referrals.assignCode(id);
            await this.logEvent(id, "register", provider);
            return id;
        }

        const existing = await this.prisma.user.findUnique({ where: { id: decision.userId } });
        if (!existing) throw new UnauthorizedException("A felhasználó nem található.");
        if (isBannedAccount(existing.status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }
        const nextName = existing.name || name;
        const nextAvatar = (existing as { avatarUrl?: string | null }).avatarUrl || avatarUrl;
        if (field === "googleId") {
            await this.prisma.$executeRaw`
                UPDATE "User"
                SET "googleId" = ${profile.providerUserId}, provider = ${provider}, "emailVerified" = TRUE,
                    name = ${nextName}, "avatarUrl" = ${nextAvatar}, "lastLoginAt" = NOW(),
                    "lastLoginProvider" = ${provider}, "updatedAt" = NOW()
                WHERE id = ${existing.id}
            `;
        } else if (field === "microsoftId") {
            await this.prisma.$executeRaw`
                UPDATE "User"
                SET "microsoftId" = ${profile.providerUserId}, provider = ${provider}, "emailVerified" = TRUE,
                    name = ${nextName}, "avatarUrl" = ${nextAvatar}, "lastLoginAt" = NOW(),
                    "lastLoginProvider" = ${provider}, "updatedAt" = NOW()
                WHERE id = ${existing.id}
            `;
        } else {
            await this.prisma.$executeRaw`
                UPDATE "User"
                SET "appleId" = ${profile.providerUserId}, provider = ${provider}, "emailVerified" = TRUE,
                    name = ${nextName}, "avatarUrl" = ${nextAvatar}, "lastLoginAt" = NOW(),
                    "lastLoginProvider" = ${provider}, "updatedAt" = NOW()
                WHERE id = ${existing.id}
            `;
        }
        await this.logEvent(existing.id, decision.action === "link" ? "link" : "login", provider);
        return existing.id;
    }

    private async logEvent(userId: string, action: string, provider: string) {
        await this.prisma.$executeRaw`
            INSERT INTO "AuthEvent" (id, "userId", action, provider, "createdAt")
            VALUES (${randomUUID()}, ${userId}, ${action}, ${provider}, NOW())
        `.catch(() => undefined);
    }
}

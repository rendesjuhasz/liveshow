import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";
import { ACCESS_COOKIE } from "../security/http-guard";
import { isBannedAccount } from "./account-status";
import { readCookie } from "./auth.cookies";
import { isAdminRole, normalizeRole, USER_ROLES } from "./roles";
import { jwtSecret } from "./secrets";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req) => {
                    if (!req) return null;
                    const fromCookie = readCookie(req as Parameters<typeof readCookie>[0], ACCESS_COOKIE);
                    return fromCookie || null;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: jwtSecret(),
        });
    }

    async validate(payload: { sub?: string; email?: string; role?: string }) {
        const userId = payload?.sub;
        if (!userId) {
            throw new UnauthorizedException("Érvénytelen token.");
        }

        const user = await this.prisma.user.findUnique({
            where: { id: String(userId) },
        });

        if (!user) {
            throw new UnauthorizedException("A felhasználó nem található.");
        }

        if (isBannedAccount((user as { status?: string }).status)) {
            throw new ForbiddenException("A fiókod tiltva van.");
        }

        const flag = await this.prisma.$queryRaw<{ emailVerified?: boolean | null }[]>`
            SELECT "emailVerified" FROM "User" WHERE id = ${user.id} LIMIT 1
        `.catch(() => [] as { emailVerified?: boolean | null }[]);

        return {
            id: user.id,
            email: user.email,
            name: (user as { name?: string | null }).name || null,
            username: (user as { username?: string | null }).username || null,
            role: isAdminRole(user) ? USER_ROLES.ADMIN : normalizeRole(user.role),
            emailVerified: flag[0]?.emailVerified !== false,
        };
    }
}

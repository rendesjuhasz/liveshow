import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";
import { isBannedAccount } from "./account-status";
import { normalizeRole } from "./roles";
import { jwtSecret } from "./secrets";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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

        return {
            id: user.id,
            email: user.email,
            name: (user as { name?: string | null }).name || null,
            role: normalizeRole(user.role),
        };
    }
}

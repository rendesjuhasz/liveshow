import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EMAIL_NOT_VERIFIED_MESSAGE } from "./email-verify";

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
        const userId = String(req.user?.id || "");
        if (!userId) {
            throw new UnauthorizedException("Érvénytelen token.");
        }

        const rows = await this.prisma.$queryRaw<{ emailVerified?: boolean | null }[]>`
            SELECT "emailVerified" FROM "User" WHERE id = ${userId} LIMIT 1
        `.catch(() => [] as { emailVerified?: boolean | null }[]);

        const found = rows[0];
        if (!found) {
            throw new UnauthorizedException("A felhasználó nem található.");
        }
        if (found.emailVerified === false) {
            throw new ForbiddenException(EMAIL_NOT_VERIFIED_MESSAGE);
        }
        return true;
    }
}

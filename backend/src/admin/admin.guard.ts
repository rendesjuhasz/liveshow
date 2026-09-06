import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isAdminUser } from "../auth/is-admin";
import { normalizeRole } from "../auth/roles";

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id || request.user?.sub;

        if (!userId) {
            throw new UnauthorizedException("Bejelentkezés szükséges.");
        }

        const user = await this.prisma.user.findUnique({
            where: { id: String(userId) },
        });

        if (!user) {
            throw new UnauthorizedException("A felhasználó nem található.");
        }

        const current = {
            id: user.id,
            email: user.email,
            role: normalizeRole(user.role),
        };

        if (!isAdminUser(current)) {
            throw new ForbiddenException("Nincs admin jogosultság.");
        }

        request.user = current;
        return true;
    }
}

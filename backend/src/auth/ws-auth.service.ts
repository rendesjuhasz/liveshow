import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";
import { isBannedAccount } from "./account-status";
import { ACCESS_COOKIE } from "../security/http-guard";
import { isAdminRole, normalizeRole, USER_ROLES } from "./roles";

export type WsUser = { id: string; email: string; role: string };

@Injectable()
export class WsAuthService {
    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    tokenFromSocket(client: Socket) {
        const auth = client.handshake?.auth as { token?: string } | undefined;
        const fromAuth = String(auth?.token || "").trim();
        if (fromAuth) return fromAuth;
        const query = client.handshake?.query as Record<string, string | string[] | undefined> | undefined;
        const rawQuery = query?.token ?? query?.auth;
        const fromQuery = String(Array.isArray(rawQuery) ? rawQuery[0] : rawQuery || "").trim();
        if (fromQuery) return fromQuery;
        const header = String(client.handshake?.headers?.authorization || "");
        if (header.toLowerCase().startsWith("bearer ")) {
            return header.slice(7).trim();
        }
        const raw = String(client.handshake?.headers?.cookie || "");
        for (const part of raw.split(";")) {
            const i = part.indexOf("=");
            if (i === -1) continue;
            if (part.slice(0, i).trim() === ACCESS_COOKIE) {
                try {
                    return decodeURIComponent(part.slice(i + 1).trim());
                } catch {
                    return part.slice(i + 1).trim();
                }
            }
        }
        return "";
    }

    async userFromToken(token: string): Promise<WsUser> {
        if (!token) throw new UnauthorizedException("Hiányzik a JWT.");
        let payload: { sub?: string; email?: string; role?: string };
        try {
            payload = await this.jwt.verifyAsync(token);
        } catch {
            throw new UnauthorizedException("Érvénytelen vagy lejárt token.");
        }
        const userId = String(payload?.sub || "").trim();
        if (!userId) throw new UnauthorizedException("Érvénytelen token.");
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException("A felhasználó nem található.");
        if (isBannedAccount((user as { status?: string }).status)) {
            throw new UnauthorizedException("A fiókod tiltva van.");
        }
        return {
            id: user.id,
            email: user.email,
            role: isAdminRole(user) ? USER_ROLES.ADMIN : normalizeRole(user.role),
        };
    }

    async userFromSocket(client: Socket) {
        return this.userFromToken(this.tokenFromSocket(client));
    }
}

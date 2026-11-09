import {
    CallHandler,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { USERNAME_REQUIRED_MESSAGE } from "./username";

function pathOf(req: Request) {
    return String(req.originalUrl || req.path || "").split("?")[0];
}

function skipUsernameGate(method: string, path: string) {
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
    const allow = [
        "/auth/login",
        "/auth/register",
        "/auth/register-streamer",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/verify-email",
        "/auth/resend-verification",
        "/auth/refresh",
        "/auth/logout",
        "/auth/csrf",
        "/auth/username",
        "/auth/oauth",
        "/api/barion",
        "/payments/stripe/webhook",
        "/socket.io",
        "/live-io",
    ];
    return allow.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

@Injectable()
export class UsernameRequiredInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const req = context.switchToHttp().getRequest<
            Request & { user?: { id?: string; username?: string | null } }
        >();
        const method = String(req.method || "GET").toUpperCase();
        const path = pathOf(req);
        if (skipUsernameGate(method, path)) {
            return next.handle();
        }
        const user = req.user;
        if (!user?.id) {
            return next.handle();
        }
        if (String(user.username || "").trim()) {
            return next.handle();
        }
        throw new ForbiddenException(USERNAME_REQUIRED_MESSAGE);
    }
}

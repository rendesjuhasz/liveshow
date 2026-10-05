import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}

/**
 * Optional JWT: try Bearer **or** ls_access cookie (JwtStrategy extractors).
 * Missing/invalid token → continue as guest. Do not skip Passport just because
 * Authorization is absent — the browser session is cookie-only.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
    async canActivate(context: ExecutionContext) {
        try {
            await super.canActivate(context);
        } catch {
            /* vendég: hiányzó vagy érvénytelen JWT */
        }
        return true;
    }

    handleRequest<TUser = any>(
        _err: any,
        user: any,
        _info?: any,
        _context?: ExecutionContext,
        _status?: any,
    ): TUser {
        return (user || null) as TUser;
    }
}

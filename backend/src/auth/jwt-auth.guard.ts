import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        if (!request.headers?.authorization) {
            return true;
        }
        try {
            return Boolean(await super.canActivate(context));
        } catch {
            return true;
        }
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

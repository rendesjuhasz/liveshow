import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isApprovedStreamer, streamerStatusMessage } from "./status";

@Injectable()
export class StreamerApprovedGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id;
        if (!userId) {
            throw new UnauthorizedException("Bejelentkezés szükséges.");
        }
        const streamer = await this.prisma.streamer.findFirst({
            where: { userId: String(userId) },
        });
        if (!streamer) {
            throw new ForbiddenException("Nincs tartalomkészítő profilod.");
        }
        if (!isApprovedStreamer(streamer.status)) {
            throw new ForbiddenException(streamerStatusMessage(streamer.status));
        }
        request.streamer = streamer;
        return true;
    }
}

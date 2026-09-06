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
        const email = String(request.user?.email || "").toLowerCase();

        if (!userId) {
            throw new UnauthorizedException("Bejelentkezés szükséges.");
        }

        const streamer = await this.prisma.streamer.findFirst({
            where: {
                OR: [{ userId: String(userId) }, ...(email ? [{ email }] : [])],
            },
        });

        if (!streamer) {
            throw new ForbiddenException("Nincs streamer profilod.");
        }

        if (!isApprovedStreamer(streamer.status)) {
            throw new ForbiddenException(streamerStatusMessage(streamer.status));
        }

        if (!streamer.userId) {
            await this.prisma.streamer.update({
                where: { id: streamer.id },
                data: { userId: String(userId) },
            });
            streamer.userId = String(userId);
        }

        request.streamer = streamer;
        return true;
    }
}

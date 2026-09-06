import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { TokenService } from "./token.service";
import { TicketsService } from "../../tickets/tickets.service";
import { ViewLogService } from "../../stats/view-log.service";

@Controller("token")
@UseGuards(JwtAuthGuard)
export class TokenController {
    constructor(
        private readonly tokenService: TokenService,
        private readonly ticketsService: TicketsService,
        private readonly views: ViewLogService,
    ) {}

    @Get("generate")
    async generate(
        @Req() req: { user: { id: string; email?: string; role?: string } },
        @Query("streamId") streamId: string,
        @Query("showId") showId: string,
        @Query("expires") expires: string,
        @Query("purpose") purpose: string,
    ) {
        await this.ticketsService.assertCanWatch(
            req.user,
            streamId,
            showId,
            purpose === "private" || purpose === "privateStream" ? "privateStream" : purpose === "archive" ? "archive" : "live",
        );

        const kind = purpose === "archive" ? "archive" : "live";
        if (kind === "live") {
            this.views.heartbeatLive({
                showId,
                streamId,
                userId: req.user.id,
            });
        }

        const expiresInSeconds = parseInt(expires, 10) || 3600;
        return this.tokenService.generateStreamToken(streamId, expiresInSeconds, req.user.id);
    }
}

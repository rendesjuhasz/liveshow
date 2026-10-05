import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { OptionalJwtAuthGuard } from "../../auth/jwt-auth.guard";
import { TokenService, HLS_ARCHIVE_TTL_SEC, HLS_LIVE_TTL_SEC } from "./token.service";
import { TicketsService } from "../../tickets/tickets.service";
import { ViewLogService } from "../../stats/view-log.service";
import { guestViewerId } from "../../stats/viewer-id";
import { HLS_COOKIE, isHttpsRequest } from "../http-guard";
import { clientKey } from "../rate-limit";

@Controller("token")
@UseGuards(OptionalJwtAuthGuard)
export class TokenController {
    constructor(
        private readonly tokenService: TokenService,
        private readonly ticketsService: TicketsService,
        private readonly views: ViewLogService,
    ) {}

    @Get("generate")
    async generate(
        @Req() req: Request & { user?: { id: string; email?: string; role?: string } },
        @Res({ passthrough: true }) res: Response,
        @Query("streamId") streamId: string,
        @Query("showId") showId: string,
        @Query("purpose") purpose: string,
        @Query("viewerKey") viewerKey?: string,
    ) {
        const feature =
            purpose === "private" || purpose === "privateStream"
                ? "privateStream"
                : purpose === "archive"
                  ? "archive"
                  : "live";
        await this.ticketsService.assertCanWatch(req.user, streamId, showId, feature);

        const userId = req.user?.id || guestViewerId(viewerKey);
        const kind = purpose === "archive" ? "archive" : "live";
        if (kind === "live") {
            this.views.heartbeatLive({
                showId,
                streamId,
                userId,
            });
        }

        const ttl = kind === "archive" ? HLS_ARCHIVE_TTL_SEC : HLS_LIVE_TTL_SEC;
        const ip = clientKey(req);
        const issued = this.tokenService.generateStreamToken(streamId, ttl, userId, ip);
        res.cookie(HLS_COOKIE, this.tokenService.encodeCookie(issued), {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: "lax",
            path: "/",
            maxAge: ttl * 1000,
        });
        return {
            streamId: issued.streamId,
            userId: issued.userId,
            expiresAt: issued.expiresAt,
            cookie: true,
        };
    }
}

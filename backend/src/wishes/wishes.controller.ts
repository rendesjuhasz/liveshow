import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StreamerApprovedGuard } from "../streamers/streamer-approved.guard";
import { assertRateLimit, clientKey } from "../security/rate-limit";
import { WishesService } from "./wishes.service";

type StreamerReq = {
    user: { id: string };
    streamer: { id: string; name: string };
};

@Controller()
export class WishesController {
    constructor(private readonly wishes: WishesService) {}

    @Get("wishes")
    list() {
        return this.wishes.listPublic();
    }

    @Get("wishes/mine")
    @UseGuards(JwtAuthGuard)
    listMine(
        @Req() req: { user: { id: string } },
        @Query("visibility") visibility?: string,
    ) {
        return this.wishes.listMine(req.user.id, visibility);
    }

    @Post("wishes")
    @UseGuards(JwtAuthGuard)
    create(
        @Req() req: { user: { id: string }; ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
        @Body() body: { text?: string; visibility?: string },
    ) {
        assertRateLimit(`wish:${req.user.id}`, 8, 15 * 60_000);
        assertRateLimit(`wish-ip:${clientKey(req)}`, 12, 15 * 60_000);
        return this.wishes.create(req.user.id, body?.text, body?.visibility);
    }

    @Get("streamer/wishes")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    listStreamer() {
        return this.wishes.listForStreamer();
    }

    @Post("streamer/wishes/:id/accept")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    accept(@Req() req: StreamerReq, @Param("id") id: string) {
        return this.wishes.accept(id, req.streamer);
    }

    @Post("streamer/wishes/:id/reject")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    reject(@Param("id") id: string) {
        return this.wishes.reject(id);
    }

    @Post("streamer/wishes/:id/complete")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    complete(@Req() req: StreamerReq, @Param("id") id: string) {
        return this.wishes.complete(id, req.streamer);
    }
}

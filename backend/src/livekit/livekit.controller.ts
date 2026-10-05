import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OptionalJwtAuthGuard } from "../auth/jwt-auth.guard";
import { LivekitTokenDto } from "../dto/bodies";
import { LivekitService } from "./livekit.service";

@Controller("livekit")
export class LivekitController {
    constructor(private readonly livekit: LivekitService) {}

    @Get("config")
    config(@Query("showId") showId?: string) {
        return this.livekit.config(showId);
    }

    @Post("token")
    @UseGuards(OptionalJwtAuthGuard)
    token(
        @Req() req: Request & { user?: { id: string; email?: string; role?: string } },
        @Body() body: LivekitTokenDto,
    ) {
        return this.livekit.issueToken(req.user, body);
    }
}

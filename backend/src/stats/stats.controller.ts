import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ViewLogService } from "./view-log.service";

@Controller("views")
export class StatsController {
    constructor(private readonly views: ViewLogService) {}

    @Get("live")
    liveAll() {
        const map = this.views.liveByShow();
        return Object.fromEntries(map.entries());
    }

    @Get("live/:showId")
    liveOne(@Param("showId") showId: string) {
        return { showId, viewerCount: this.views.liveCountFor(showId) };
    }

    @Post("live")
    @UseGuards(JwtAuthGuard)
    ping(
        @Req() req: { user: { id: string } },
        @Body() body: { showId?: string; streamId?: string },
    ) {
        this.views.heartbeatLive({
            showId: body.showId,
            streamId: body.streamId,
            userId: req.user.id,
        });
        return { viewerCount: this.views.liveCountFor(String(body.showId || "")) };
    }

    @Post("archive")
    @UseGuards(JwtAuthGuard)
    qualify(
        @Req() req: { user: { id: string } },
        @Body() body: { showId?: string; seconds?: number; duration?: number },
    ) {
        return this.views.qualifyArchiveView({
            showId: String(body.showId || ""),
            userId: req.user.id,
            seconds: body.seconds,
            duration: body.duration,
        });
    }
}

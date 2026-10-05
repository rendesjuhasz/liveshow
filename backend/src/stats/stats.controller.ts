import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../auth/jwt-auth.guard";
import { ViewLogService } from "./view-log.service";
import { guestViewerId } from "./viewer-id";
import { ArchiveViewDto, LiveViewDto } from "../dto/bodies";

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
    @UseGuards(OptionalJwtAuthGuard)
    ping(
        @Req() req: { user?: { id: string } },
        @Body() body: LiveViewDto,
    ) {
        this.views.heartbeatLive({
            showId: body.showId,
            streamId: body.streamId,
            userId: req.user?.id || guestViewerId(body.viewerKey),
        });
        return { viewerCount: this.views.liveCountFor(String(body.showId || "")) };
    }

    @Post("archive")
    @UseGuards(JwtAuthGuard)
    qualify(
        @Req() req: { user: { id: string } },
        @Body() body: ArchiveViewDto,
    ) {
        return this.views.qualifyArchiveView({
            showId: String(body.showId || ""),
            userId: req.user.id,
            seconds: body.seconds,
            duration: body.duration,
        });
    }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FollowsService, type NotifyPrefs } from "./follows.service";

@Controller()
export class FollowsController {
    constructor(private readonly follows: FollowsService) {}

    @Post("streamers/:id/follow")
    @UseGuards(JwtAuthGuard)
    follow(@Req() req: { user: { id: string } }, @Param("id") id: string) {
        return this.follows.follow(req.user.id, id);
    }

    @Delete("streamers/:id/follow")
    @UseGuards(JwtAuthGuard)
    unfollow(@Req() req: { user: { id: string } }, @Param("id") id: string) {
        return this.follows.unfollow(req.user.id, id);
    }

    @Get("notifications/prefs")
    @UseGuards(JwtAuthGuard)
    prefs(@Req() req: { user: { id: string } }) {
        return this.follows.getPrefs(req.user.id);
    }

    @Patch("notifications/prefs")
    @UseGuards(JwtAuthGuard)
    setPrefs(@Req() req: { user: { id: string } }, @Body() body: Partial<NotifyPrefs>) {
        return this.follows.setPrefs(req.user.id, body);
    }

    @Post("notifications/:id/click")
    @UseGuards(JwtAuthGuard)
    click(@Req() req: { user: { id: string } }, @Param("id") id: string) {
        return this.follows.recordOpen(req.user.id, id);
    }
}

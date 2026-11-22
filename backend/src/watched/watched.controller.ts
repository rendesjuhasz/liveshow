import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WatchedService } from "./watched.service";

@Controller("watched")
@UseGuards(JwtAuthGuard)
export class WatchedController {
    constructor(private readonly watched: WatchedService) {}

    @Get()
    list(@Req() req: { user: { id: string } }) {
        return this.watched.list(req.user.id);
    }

    @Post()
    add(@Req() req: { user: { id: string } }, @Body() body: { showId?: string }) {
        return this.watched.add(req.user.id, body?.showId);
    }

    @Post("import")
    importGuest(
        @Req() req: { user: { id: string } },
        @Body() body: { showIds?: string[] },
    ) {
        return this.watched.importIds(req.user.id, body?.showIds);
    }
}

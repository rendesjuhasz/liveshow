import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../auth/jwt-auth.guard";
import { ModeratorGuard } from "../questions/moderator.guard";
import { ReviewsService } from "./reviews.service";

@Controller("reviews")
export class ReviewsController {
    constructor(private readonly reviews: ReviewsService) {}

    @Get("show/:showId")
    @UseGuards(OptionalJwtAuthGuard)
    list(
        @Param("showId") showId: string,
        @Req() req: { user?: { id?: string } },
    ) {
        return this.reviews.listForShow(showId, req.user?.id);
    }

    @Get("moderation")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    moderation() {
        return this.reviews.listForModeration();
    }

    @Patch(":id/status")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    setStatus(@Param("id") id: string, @Body() body: { status?: string }) {
        return this.reviews.setStatus(id, body.status);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(
        @Req() req: { user: { id: string } },
        @Body() body: { showId?: string; rating?: number; comment?: string },
    ) {
        return this.reviews.create(req.user.id, body.showId, body.rating, body.comment);
    }
}

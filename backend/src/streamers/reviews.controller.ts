import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { ModeratorGuard } from "../questions/moderator.guard";
import { ReviewsService } from "./reviews.service";
import { ReviewCreateDto, StatusDto } from "../dto/bodies";

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
    setStatus(@Param("id") id: string, @Body() body: StatusDto) {
        return this.reviews.setStatus(id, body.status);
    }

    @Post()
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    async create(
        @Req() req: { user: { id: string } },
        @Body() body: ReviewCreateDto,
    ) {
        return this.reviews.create(req.user.id, body.showId, body.rating, body.comment);
    }
}

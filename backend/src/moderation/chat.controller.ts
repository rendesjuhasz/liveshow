import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { ModeratorGuard } from "../questions/moderator.guard";
import { ChatService } from "./chat.service";
import { ChatPostDto } from "../dto/bodies";

@Controller()
export class ChatController {
    constructor(private readonly chat: ChatService) {}

    @Get("shows/:showId/chat")
    list(@Param("showId") showId: string) {
        return this.chat.listApproved(showId);
    }

    @Get("shows/:showId/chat/mine")
    @UseGuards(JwtAuthGuard)
    mine(@Req() req: { user: { id: string } }, @Param("showId") showId: string) {
        return this.chat.listMine(req.user.id, showId);
    }

    @Post("shows/:showId/chat")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    post(
        @Req() req: { user: { id: string } },
        @Param("showId") showId: string,
        @Body() body: ChatPostDto,
    ) {
        return this.chat.post(req.user.id, showId, body.text);
    }

    @Get("shows/:showId/chat/moderation")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    moderation(@Param("showId") showId: string) {
        return this.chat.listForModeration(showId, { isMod: true });
    }

    @Patch("chat/:id")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    hideMod(@Req() req: { user: { id: string } }, @Param("id") id: string) {
        return this.chat.hide({ isMod: true, userId: req.user.id }, id);
    }
}

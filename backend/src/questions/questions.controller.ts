import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { ModeratorGuard } from "./moderator.guard";
import { QuestionsService } from "./questions.service";
import { BannedWordDto, QuestionCreateDto, StatusNoteDto, SupportDto } from "../dto/bodies";

@Controller()
export class QuestionsController {
    constructor(private readonly questionsService: QuestionsService) {}

    @Get("questions")
    list(@Query("showId") showId: string) {
        return this.questionsService.listApproved(showId);
    }

    @Get("questions/mine")
    @UseGuards(JwtAuthGuard)
    mine(@Req() req: { user: { id: string } }, @Query("showId") showId: string) {
        return this.questionsService.listMine(req.user.id, showId);
    }

    @Post("questions")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    add(
        @Req() req: { user: { id: string } },
        @Body() body: QuestionCreateDto,
    ) {
        return this.questionsService.addQuestion(req.user.id, body.showId, body.text);
    }

    @Post("shows/:showId/support")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    support(
        @Req() req: { user: { id: string } },
        @Param("showId") showId: string,
        @Body() body: SupportDto,
    ) {
        return this.questionsService.addSupport(req.user.id, showId, body.kind, body.text);
    }

    @Get("notifications")
    @UseGuards(JwtAuthGuard)
    notifications(@Req() req: { user: { id: string } }) {
        return this.questionsService.listNotifications(req.user.id);
    }

    @Post("notifications/:id/read")
    @UseGuards(JwtAuthGuard)
    readNote(
        @Req() req: { user: { id: string } },
        @Param("id") id: string,
    ) {
        return this.questionsService.markNotificationRead(req.user.id, id);
    }

    @Get("questions/moderation")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    moderation(@Query("showId") showId: string) {
        return this.questionsService.listForModeration(showId);
    }

    @Get("questions/audit")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    audit(@Query("showId") showId: string) {
        return this.questionsService.listAudit(showId);
    }

    @Patch("questions/:id/review")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    review(
        @Req() req: { user: { id: string; role?: string; email?: string } },
        @Param("id") id: string,
        @Body() body: StatusNoteDto,
    ) {
        return this.questionsService.review(req.user, id, body.status, body.note);
    }

    @Get("questions/banned-words")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    banned() {
        return this.questionsService.listBannedWords();
    }

    @Post("questions/banned-words")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    addBanned(@Body() body: BannedWordDto) {
        return this.questionsService.addBannedWord(body.word);
    }

    @Delete("questions/banned-words/:id")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    removeBanned(@Param("id") id: string) {
        return this.questionsService.removeBannedWord(id);
    }
}

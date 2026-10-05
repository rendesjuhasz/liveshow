import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    Res,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FileFieldsInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { avatarMulterOptions, avatarPublicPath } from "../uploads/avatar-multer";
import { vodMulterOptions, liveArchiveMulterOptions } from "../uploads/vod-multer";
import { assertUploadedMedia } from "../uploads/upload-magic";
import { StreamerApprovedGuard } from "./streamer-approved.guard";
import { StreamerDashboardService } from "./streamer-dashboard.service";
import type { Response } from "express";
import { PayoutAmountDto, ShowBodyDto, ShowIdDto, ShowLiveDto, StatusNoteDto, StreamerHelpDto, StreamerLegalDto, StreamerProfileDto, VodUploadDto } from "../dto/bodies";
import { ContactService } from "../contact/contact.service";
import { contactShotMulterOptions, contactShotStoredPath } from "../uploads/contact-shot-multer";
import { assertRateLimit } from "../security/rate-limit";

type Authed = {
    user: { id: string; email: string };
    streamer: {
        id: string;
        name: string;
        email: string;
        bio: string | null;
        avatarUrl: string | null;
        category: string;
        contactEmail: string;
        status: string;
        userId?: string | null;
    };
};

@Controller("streamer")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, StreamerApprovedGuard)
export class StreamerDashboardController {
    constructor(
        private readonly dashboard: StreamerDashboardService,
        private readonly contact: ContactService,
    ) {}

    @Post("help/report")
    @UseInterceptors(FileInterceptor("screenshot", contactShotMulterOptions()))
    async reportHelp(
        @Req() req: Authed,
        @UploadedFile() file: { filename?: string; path?: string; mimetype?: string } | undefined,
        @Body() body: StreamerHelpDto,
    ) {
        await assertRateLimit(`streamer-help:${req.user.id}`, 8, 15 * 60_000);
        if (file?.path) {
            assertUploadedMedia(String(file.path), String(file.mimetype || ""), "image");
        }
        const name = String(req.streamer?.name || req.user.email || "Tartalomkészítő").trim();
        const email = String(req.streamer?.contactEmail || req.user.email || "").trim();
        return this.contact.submitStreamerReport({
            name,
            email,
            topic: body.topic,
            description: body.description,
            screenshotPath: file?.filename ? contactShotStoredPath(file.filename) : null,
        });
    }

    @Post("vod")
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: "video", maxCount: 1 },
                { name: "cover", maxCount: 1 },
            ],
            vodMulterOptions(),
        ),
    )
    uploadVod(
        @Req() req: Authed,
        @UploadedFiles()
        files: {
            video?: { filename: string; path: string; size: number; originalname: string }[];
            cover?: { filename: string; path: string; size: number }[];
        },
        @Body() body: VodUploadDto,
    ) {
        return this.dashboard.uploadVod(req.streamer, body, files || {});
    }

    @Get("shows")
    shows(@Req() req: Authed) {
        return this.dashboard.listShows(req.streamer);
    }

    @Post("shows")
    createShow(
        @Req() req: Authed,
        @Body() body: ShowBodyDto,
    ) {
        return this.dashboard.createShow(req.streamer, body);
    }

    @Get("shows/:id")
    getShow(@Req() req: Authed, @Param("id") id: string) {
        return this.dashboard.getShow(req.streamer, id);
    }

    @Post("shows/:id/submit")
    submitShow(@Req() req: Authed, @Param("id") id: string) {
        return this.dashboard.submitShow(req.streamer, id);
    }

    @Patch("shows/:id")
    updateShow(
        @Req() req: Authed,
        @Param("id") id: string,
        @Body() body: ShowBodyDto,
    ) {
        return this.dashboard.updateShow(req.streamer, id, body);
    }

    @Post("shows/:id/live")
    setLive(
        @Req() req: Authed,
        @Param("id") id: string,
        @Body() body: ShowLiveDto,
    ) {
        return this.dashboard.setLive(req.streamer, id, body);
    }

    @Post("shows/:id/live-archive")
    @UseInterceptors(FileInterceptor("video", liveArchiveMulterOptions()))
    ingestLiveArchive(
        @Req() req: Authed,
        @Param("id") id: string,
        @UploadedFile() file: { path?: string; size?: number; mimetype?: string; originalname?: string } | undefined,
    ) {
        return this.dashboard.ingestLiveArchive(req.streamer, id, file);
    }

    @Get("follow-stats")
    followStats(@Req() req: Authed) {
        return this.dashboard.followStats(req.streamer);
    }

    @Get("view-stats")
    viewStats(@Req() req: Authed) {
        return this.dashboard.viewStats(req.streamer);
    }

    @Get("revenue")
    revenue(@Req() req: Authed) {
        return this.dashboard.getRevenue(req.streamer);
    }

    @Get("payouts")
    payouts(@Req() req: Authed) {
        return this.dashboard.listPayouts(req.streamer);
    }

    @Post("payouts")
    requestPayout(@Req() req: Authed, @Body() body: PayoutAmountDto) {
        return this.dashboard.requestPayout(req.streamer, body.amount, req.user.id);
    }

    @Get("payouts/:id/receipt")
    async receipt(
        @Req() req: Authed,
        @Param("id") id: string,
        @Res() res: Response,
    ) {
        const html = await this.dashboard.receiptHtml(req.streamer, id);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="kifizetes-${id.slice(0, 8)}.html"`);
        res.send(html);
    }

    @Get("legal")
    legal(@Req() req: Authed) {
        return this.dashboard.legal(req.streamer);
    }

    @Patch("legal")
    updateLegal(
        @Req() req: Authed,
        @Body() body: StreamerLegalDto,
    ) {
        return this.dashboard.updateLegal(req.streamer, body);
    }

    @Get("leaderboard")
    leaderboard() {
        return this.dashboard.leaderboard();
    }

    @Get("reviews")
    reviews(@Req() req: Authed) {
        return this.dashboard.listReviews(req.streamer);
    }

    @Get("questions/queue")
    questionQueue(@Req() req: Authed, @Query("showId") showId?: string) {
        return this.dashboard.listQuestionQueue(req.streamer, showId);
    }

    @Get("questions")
    questions(@Req() req: Authed, @Query("showId") showId?: string) {
        return this.dashboard.listApprovedQuestions(req.streamer, showId);
    }

    @Post("questions/next")
    nextQuestion(@Req() req: Authed, @Body() body: ShowIdDto) {
        return this.dashboard.fulfillCurrentQuestion(req.streamer, body?.showId);
    }

    @Post("questions/reject")
    rejectQuestion(@Req() req: Authed, @Body() body: ShowIdDto) {
        return this.dashboard.rejectCurrentQuestion(req.streamer, body?.showId);
    }

    @Get("support")
    support(@Req() req: Authed, @Query("showId") showId?: string) {
        return this.dashboard.listSupport(req.streamer, showId);
    }

    @Patch("questions/:id/review")
    rejectQueued(
        @Req() req: Authed,
        @Param("id") id: string,
        @Body() body: StatusNoteDto,
    ) {
        return this.dashboard.rejectQueuedQuestion(req.streamer, id, body.note);
    }

    @Get("reports")
    reports(@Req() req: Authed, @Query("status") status?: string) {
        return this.dashboard.listReports(req.streamer, status);
    }

    @Patch("reports/:id")
    resolveReport(
        @Req() req: Authed,
        @Param("id") id: string,
        @Body() body: StatusNoteDto,
    ) {
        return this.dashboard.resolveReport(req.streamer, id, body.status, body.note);
    }

    @Get("chat")
    chat(@Req() req: Authed, @Query("showId") showId?: string) {
        return this.dashboard.listChat(req.streamer, showId);
    }

    @Patch("chat/:id")
    hideChat(@Req() req: Authed, @Param("id") id: string) {
        return this.dashboard.hideChat(req.streamer, id);
    }

    @Patch("profile")
    @UseInterceptors(FileInterceptor("avatar", avatarMulterOptions()))
    updateProfile(
        @Req() req: Authed,
        @UploadedFile() file: { filename?: string; path?: string; mimetype?: string } | undefined,
        @Body() body: StreamerProfileDto,
    ) {
        if (file?.filename) {
            assertUploadedMedia(String(file.path || ""), String(file.mimetype || ""), "image");
        }
        return this.dashboard.updateProfile(req.streamer, {
            ...body,
            avatarUrl: file?.filename ? avatarPublicPath(file.filename) : undefined,
        });
    }
}

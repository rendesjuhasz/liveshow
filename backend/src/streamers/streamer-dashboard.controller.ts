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
import { avatarMulterOptions, avatarPublicPath } from "../uploads/avatar-multer";
import { vodMulterOptions } from "../uploads/vod-multer";
import { StreamerApprovedGuard } from "./streamer-approved.guard";
import { StreamerDashboardService } from "./streamer-dashboard.service";
import type { Response } from "express";

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
    };
};

@Controller("streamer")
@UseGuards(JwtAuthGuard, StreamerApprovedGuard)
export class StreamerDashboardController {
    constructor(private readonly dashboard: StreamerDashboardService) {}

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
        @Body() body: { title?: string; description?: string; videoCategory?: string },
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
        @Body()
        body: {
            title?: string;
            description?: string;
            image?: string;
            startTime?: string;
            date?: string;
            price?: number;
            streamId?: string;
            streamUrl?: string;
            categoryKeys?: string[];
            videoCategory?: string;
        },
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
        @Body() body: Record<string, unknown>,
    ) {
        return this.dashboard.updateShow(req.streamer, id, body as any);
    }

    @Post("shows/:id/live")
    setLive(
        @Req() req: Authed,
        @Param("id") id: string,
        @Body() body: { live?: boolean; streamId?: string; rtpPort?: number },
    ) {
        return this.dashboard.setLive(req.streamer, id, body);
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
    requestPayout(@Req() req: Authed, @Body() body: { amount?: number }) {
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
        @Body()
        body: {
            invoiceCapable?: boolean;
            taxDeclarationAccepted?: boolean;
            contractShareAccepted?: boolean;
            preferredPayoutMethod?: string;
        },
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

    @Get("questions")
    questions(@Req() req: Authed, @Query("showId") showId?: string) {
        return this.dashboard.listApprovedQuestions(req.streamer, showId);
    }

    @Post("questions/next")
    nextQuestion(@Req() req: Authed, @Body() body: { showId?: string }) {
        return this.dashboard.fulfillCurrentQuestion(req.streamer, body?.showId);
    }

    @Post("questions/reject")
    rejectQuestion(@Req() req: Authed, @Body() body: { showId?: string }) {
        return this.dashboard.rejectCurrentQuestion(req.streamer, body?.showId);
    }

    @Get("support")
    support(@Req() req: Authed, @Query("showId") showId?: string) {
        return this.dashboard.listSupport(req.streamer, showId);
    }

    @Patch("profile")
    @UseInterceptors(FileInterceptor("avatar", avatarMulterOptions()))
    updateProfile(
        @Req() req: Authed,
        @UploadedFile() file: { filename?: string } | undefined,
        @Body()
        body: {
            name?: string;
            bio?: string;
            category?: string;
            contactEmail?: string;
        },
    ) {
        return this.dashboard.updateProfile(req.streamer, {
            ...body,
            avatarUrl: file?.filename ? avatarPublicPath(file.filename) : undefined,
        });
    }
}

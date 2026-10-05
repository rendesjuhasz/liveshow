import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    Res,
    UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { StreamersService } from "./streamers.service";
import type { Response } from "express";
import { AdminCreateStreamerDto, PayoutCreateDto, PayoutPaidDto, StatusDto, StreamerNameBioDto } from "../dto/bodies";

@Controller()
export class StreamersController {
    constructor(private readonly streamersService: StreamersService) {}

    @Get("streamers")
    listPublic() {
        return this.streamersService.list();
    }

    @Get("streamers/me")
    @UseGuards(JwtAuthGuard)
    me(@Req() req: { user: { id: string; email: string } }) {
        return this.streamersService.getDashboard(req.user);
    }

    @Post("streamers/me")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    createOwn(
        @Req() req: { user: { id: string; email: string } },
        @Body() body: StreamerNameBioDto,
    ) {
        return this.streamersService.createOwn(req.user, body);
    }

    @Post("streamers/me/claim-link")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    claimLink(
        @Req() req: { user: { id: string; email: string } },
        @Body() body: { token?: string },
    ) {
        return this.streamersService.claimLinkToken(req.user, body?.token);
    }

    @Get("streamers/leaderboard")
    publicLeaderboard() {
        return this.streamersService.leaderboard();
    }

    @Get("streamers/:id")
    @UseGuards(OptionalJwtAuthGuard)
    getPublic(@Param("id") id: string, @Req() req: { user?: { id?: string } }) {
        return this.streamersService.getPublicProfile(id, req.user?.id);
    }

    @Get("admin/streamers")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    listAdmin() {
        return this.streamersService.listAll();
    }

    @Post("admin/streamers")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    create(@Body() body: AdminCreateStreamerDto) {
        return this.streamersService.create(body);
    }

    @Post("admin/streamers/:id/link-token")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    issueLink(@Param("id") id: string) {
        return this.streamersService.issueLinkToken(id);
    }

    @Patch("admin/streamers/:id/status")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    setStatus(@Param("id") id: string, @Body() body: StatusDto) {
        return this.streamersService.setStatus(id, body.status);
    }

    @Delete("admin/streamers/:id")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    remove(@Param("id") id: string) {
        return this.streamersService.remove(id);
    }

    @Get("admin/payouts/:id/receipt")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    async adminReceipt(@Param("id") id: string, @Res() res: Response) {
        const html = await this.streamersService.payoutReceipt(id);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="kifizetes-${id.slice(0, 8)}.html"`);
        res.send(html);
    }

    @Get("admin/payouts")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    payouts() {
        return this.streamersService.listPayouts();
    }

    @Get("admin/ticket-group-report")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    ticketGroupReport() {
        return this.streamersService.ticketGroupReport();
    }

    @Post("admin/payouts")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    createPayout(@Body() body: PayoutCreateDto) {
        return this.streamersService.createPayout(body.streamerId, body.amount);
    }

    @Patch("admin/payouts/:id")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    setPayout(@Param("id") id: string, @Body() body: StatusDto) {
        return this.streamersService.setPayoutStatus(id, body.status);
    }

    @Post("admin/payouts/:id/approve")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    approvePayout(@Param("id") id: string) {
        return this.streamersService.approvePayout(id);
    }

    @Post("admin/payouts/:id/paid")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    markPaid(@Param("id") id: string, @Body() body: PayoutPaidDto) {
        return this.streamersService.markPayoutPaid(id, body?.method);
    }

    @Post("admin/payouts/:id/reject")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    rejectPayout(@Param("id") id: string) {
        return this.streamersService.rejectPayout(id);
    }
}

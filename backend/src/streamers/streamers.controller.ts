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
import { AdminGuard } from "../admin/admin.guard";
import { StreamersService } from "./streamers.service";
import type { Response } from "express";

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
    @UseGuards(JwtAuthGuard)
    createOwn(
        @Req() req: { user: { id: string; email: string } },
        @Body() body: { name?: string; bio?: string },
    ) {
        return this.streamersService.createOwn(req.user, body);
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
    @UseGuards(JwtAuthGuard, AdminGuard)
    listAdmin() {
        return this.streamersService.listAll();
    }

    @Post("admin/streamers")
    @UseGuards(JwtAuthGuard, AdminGuard)
    create(@Body() body: { name?: string; email?: string; bio?: string; userId?: string }) {
        return this.streamersService.create(body);
    }

    @Patch("admin/streamers/:id/status")
    @UseGuards(JwtAuthGuard, AdminGuard)
    setStatus(@Param("id") id: string, @Body() body: { status?: string }) {
        return this.streamersService.setStatus(id, body.status);
    }

    @Delete("admin/streamers/:id")
    @UseGuards(JwtAuthGuard, AdminGuard)
    remove(@Param("id") id: string) {
        return this.streamersService.remove(id);
    }

    @Get("admin/payouts/:id/receipt")
    @UseGuards(JwtAuthGuard, AdminGuard)
    async adminReceipt(@Param("id") id: string, @Res() res: Response) {
        const html = await this.streamersService.payoutReceipt(id);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="kifizetes-${id.slice(0, 8)}.html"`);
        res.send(html);
    }

    @Get("admin/payouts")
    @UseGuards(JwtAuthGuard, AdminGuard)
    payouts() {
        return this.streamersService.listPayouts();
    }

    @Get("admin/ticket-group-report")
    @UseGuards(JwtAuthGuard, AdminGuard)
    ticketGroupReport() {
        return this.streamersService.ticketGroupReport();
    }

    @Post("admin/payouts")
    @UseGuards(JwtAuthGuard, AdminGuard)
    createPayout(@Body() body: { streamerId?: string; amount?: number }) {
        return this.streamersService.createPayout(body.streamerId, body.amount);
    }

    @Patch("admin/payouts/:id")
    @UseGuards(JwtAuthGuard, AdminGuard)
    setPayout(@Param("id") id: string, @Body() body: { status?: string }) {
        return this.streamersService.setPayoutStatus(id, body.status);
    }

    @Post("admin/payouts/:id/approve")
    @UseGuards(JwtAuthGuard, AdminGuard)
    approvePayout(@Param("id") id: string) {
        return this.streamersService.approvePayout(id);
    }

    @Post("admin/payouts/:id/paid")
    @UseGuards(JwtAuthGuard, AdminGuard)
    markPaid(@Param("id") id: string, @Body() body: { method?: string }) {
        return this.streamersService.markPayoutPaid(id, body?.method);
    }

    @Post("admin/payouts/:id/reject")
    @UseGuards(JwtAuthGuard, AdminGuard)
    rejectPayout(@Param("id") id: string) {
        return this.streamersService.rejectPayout(id);
    }
}

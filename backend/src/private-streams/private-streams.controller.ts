import { Body, Controller, Get, Param, Post, Put, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { StreamerApprovedGuard } from "../streamers/streamer-approved.guard";
import { isAdminUser } from "../auth/is-admin";
import { assertRateLimit } from "../security/rate-limit";
import { PrivateStreamsService } from "./private-streams.service";
import { PriceBandsDto, PrivateApplyDto, PrivateRequestDto, PrivateSelectDto } from "../dto/bodies";

type Authed = { user: { id: string; role?: string } };
type StreamerReq = Authed & { streamer: { id: string; name: string; userId?: string | null } };

@Controller()
export class PrivateStreamsController {
    constructor(private readonly privateStreams: PrivateStreamsService) {}

    @Get("private-requests/meta")
    meta() {
        return this.privateStreams.meta();
    }

    @Get("private-requests/price-bands")
    bands() {
        return this.privateStreams.bands();
    }

    @Get("private-requests")
    @UseGuards(JwtAuthGuard)
    list(@Req() req: Authed) {
        return this.privateStreams.listMine(req.user.id);
    }

    @Get("private-requests/mine")
    @UseGuards(JwtAuthGuard)
    mine(@Req() req: Authed) {
        return this.privateStreams.listMine(req.user.id);
    }

    @Get("private-requests/:id")
    @UseGuards(JwtAuthGuard)
    one(@Req() req: Authed, @Param("id") id: string) {
        if (id === "mine" || id === "meta" || id === "price-bands") {
            if (id === "meta") return this.privateStreams.meta();
            if (id === "price-bands") return this.privateStreams.bands();
            return this.privateStreams.listMine(req.user.id);
        }
        return this.privateStreams.getRequest(id, { userId: req.user.id, role: "viewer" });
    }

    @Post("private-requests")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    async create(
        @Req() req: Authed,
        @Body() body: PrivateRequestDto,
    ) {
        await assertRateLimit(`private-req:${req.user.id}`, 8, 15 * 60_000);
        return this.privateStreams.createRequest(req.user.id, body);
    }

    @Post("private-requests/:id/select")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    select(
        @Req() req: Authed,
        @Param("id") id: string,
        @Body() body: PrivateSelectDto,
    ) {
        return this.privateStreams.selectOffer(req.user.id, id, String(body.offerId || ""), body.startAt);
    }

    @Post("private-requests/:id/checkout")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    checkout(@Req() req: Authed, @Param("id") id: string) {
        return this.privateStreams.checkout(req.user.id, id);
    }

    @Get("private-requests/:id/watch")
    @UseGuards(JwtAuthGuard)
    watch(@Req() req: Authed, @Param("id") id: string) {
        return this.privateStreams.watch(req.user.id, id, isAdminUser(req.user));
    }

    @Get("streamer/private-requests")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    listStreamer() {
        return this.privateStreams.listOpenForStreamers();
    }

    @Get("streamer/private-requests/band")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    band(@Req() req: StreamerReq) {
        return this.privateStreams.bandForStreamer(req.streamer.id);
    }

    @Get("streamer/private-requests/:id")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    oneStreamer(@Req() req: StreamerReq, @Param("id") id: string) {
        return this.privateStreams.getRequest(id, {
            userId: req.user.id,
            role: "streamer",
            streamerId: req.streamer.id,
        });
    }

    @Post("streamer/private-requests/:id/apply")
    @UseGuards(JwtAuthGuard, StreamerApprovedGuard)
    apply(
        @Req() req: StreamerReq,
        @Param("id") id: string,
        @Body() body: PrivateApplyDto,
    ) {
        return this.privateStreams.apply(id, req.streamer, body);
    }

    @Get("admin/private-price-bands")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    adminBands() {
        return this.privateStreams.bands();
    }

    @Put("admin/private-price-bands")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    saveBands(@Body() body: PriceBandsDto) {
        return this.privateStreams.saveBands(body.items || []);
    }

    @Get("admin/private-backups")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    backups() {
        return this.privateStreams.listBackups();
    }

    @Get("admin/private-backups/:id/file")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    async backupFile(@Param("id") id: string, @Res() res: Response) {
        const row = await this.privateStreams.backupFile(id);
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="private-backup-${id}.mp4"`);
        res.sendFile(row.filePath);
    }
}

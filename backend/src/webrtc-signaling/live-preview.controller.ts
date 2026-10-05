import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LivePreviewDto } from "../dto/bodies";
import { isAdminRole } from "../auth/roles";
import { PrismaService } from "../prisma/prisma.service";
import { TicketsService } from "../tickets/tickets.service";
import { LivePreviewService } from "./live-preview.service";

@Controller("live-preview")
export class LivePreviewController {
    constructor(
        private readonly preview: LivePreviewService,
        private readonly prisma: PrismaService,
        private readonly tickets: TicketsService,
    ) {}

    @Get(":showId")
    async get(@Param("showId") showId: string, @Req() req: Request, @Res() res: Response) {
        const id = String(showId || "").trim();
        const show = await this.prisma.show.findUnique({ where: { id } });
        if (!show) {
            res.status(404).end();
            return;
        }
        const streamId = String(show.streamId || show.privateStreamId || "").trim();
        if (streamId) {
            try {
                const user = (req as Request & { user?: { id?: string; email?: string; role?: string } }).user;
                await this.tickets.assertCanWatch(user, streamId, id, "live");
            } catch {
                res.status(403).end();
                return;
            }
        }
        const frame = this.preview.get(id);
        if (!frame) {
            res.status(204).end();
            return;
        }
        res.setHeader("Content-Type", frame.mime);
        res.setHeader("Cache-Control", "no-store");
        res.send(frame.buf);
    }

    @Post(":showId")
    @UseGuards(JwtAuthGuard)
    async post(
        @Param("showId") showId: string,
        @Body() body: LivePreviewDto,
        @Req() req: Request & { user: { id: string; role?: string } },
    ) {
        const id = String(showId || "").trim();
        const show = await this.prisma.show.findUnique({
            where: { id },
            include: { streamer: { select: { userId: true } } },
        });
        if (!show) return { ok: false };
        const owner = show.streamer?.userId === req.user.id;
        if (!owner && !isAdminRole(req.user)) return { ok: false };
        this.preview.put(id, body.mime, body.data);
        return { ok: true };
    }
}

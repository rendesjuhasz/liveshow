import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { Response } from "express";
import * as fs from "fs";
import { TokenService } from "../security/token/token.service";
import { getHlsPlaylistFile, getHlsSegmentFile } from "../streaming/hls-paths";
import { LiveViewTracker } from "../stats/live-view-tracker";
import { PrismaService } from "../prisma/prisma.service";

@Controller("output")
export class HlsController {
    constructor(
        private readonly tokenService: TokenService,
        private readonly live: LiveViewTracker,
        private readonly prisma: PrismaService,
    ) {}

    @Get(":streamId/index.m3u8")
    getPlaylist(
        @Param("streamId") streamId: string,
        @Query("token") token: string,
        @Query("expiresAt") expiresAt: string,
        @Query("userId") userId: string,
        @Res() res: Response,
    ) {
        if (!this.isTokenValid(streamId, token, expiresAt, userId)) {
            return res.status(403).send("Érvénytelen vagy lejárt stream token.");
        }

        this.markLive(streamId, userId).catch(() => undefined);

        const filePath = getHlsPlaylistFile(streamId);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("A HLS playlist nem található.");
        }

        const playlist = fs.readFileSync(filePath, "utf8");
        const signed = playlist.replace(
            /(\.ts|\.m4s)(\?[^\s]*)?/g,
            `$1?token=${encodeURIComponent(token)}&expiresAt=${encodeURIComponent(expiresAt)}&userId=${encodeURIComponent(userId)}`,
        );

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.send(signed);
    }

    @Get(":streamId/:segment")
    getSegment(
        @Param("streamId") streamId: string,
        @Param("segment") segment: string,
        @Query("token") token: string,
        @Query("expiresAt") expiresAt: string,
        @Query("userId") userId: string,
        @Res() res: Response,
    ) {
        if (!this.isTokenValid(streamId, token, expiresAt, userId)) {
            return res.status(403).send("Érvénytelen vagy lejárt stream token.");
        }

        if (!/\.(ts|m4s|mp4|m3u8)$/i.test(segment)) {
            return res.status(403).send("Érvénytelen HLS szegmens.");
        }

        const filePath = getHlsSegmentFile(streamId, segment);
        const fallback =
            segment === "archive.mp4"
                ? getHlsSegmentFile(streamId, "recording.mp4")
                : "";
        const resolved =
            fs.existsSync(filePath)
                ? filePath
                : fallback && fs.existsSync(fallback)
                  ? fallback
                  : "";
        if (!resolved) {
            return res.status(404).send("A HLS szegmens nem található.");
        }

        if (segment.endsWith(".m3u8")) {
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            res.setHeader("Cache-Control", "no-cache");
        } else if (segment.endsWith(".mp4")) {
            res.setHeader("Content-Type", "video/mp4");
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader(
                "Content-Disposition",
                segment === "archive.mp4" ? "inline; filename=\"archive.mp4\"" : "inline",
            );
        } else {
            res.setHeader("Content-Type", "video/MP2T");
            res.setHeader("Cache-Control", "public, max-age=5");
        }

        return res.sendFile(resolved, { acceptRanges: true });
    }

    private isTokenValid(streamId: string, token: string, expiresAt: string, userId: string) {
        if (!token || !expiresAt || !userId) return false;

        const expires = Number(expiresAt);
        const now = Math.floor(Date.now() / 1000);
        if (!expires || expires < now) return false;

        return this.tokenService.validateStreamToken(streamId, token, expires, userId);
    }

    private async markLive(streamId: string, userId?: string) {
        const show = await this.prisma.show.findFirst({
            where: { OR: [{ streamId }, { privateStreamId: streamId }] },
            select: { id: true, streamId: true, live: true },
        });
        if (!show?.live) return;
        this.live.heartbeat({
            streamId,
            showId: show.id,
            userId: userId || null,
        });
    }
}

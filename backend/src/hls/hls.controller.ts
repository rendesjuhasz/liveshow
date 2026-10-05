import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { promises as fsp } from "fs";
import { TokenService } from "../security/token/token.service";
import { getHlsPlaylistFile, getHlsSegmentFile } from "../streaming/hls-paths";
import { HLS_COOKIE } from "../security/http-guard";
import { clientKey } from "../security/rate-limit";
import { readCookie } from "../auth/auth.cookies";
import { pathExists } from "../streaming/fs-async";

@Controller("output")
export class HlsController {
    constructor(private readonly tokenService: TokenService) {}

    @Get(":streamId/index.m3u8")
    async getPlaylist(@Param("streamId") streamId: string, @Req() req: Request, @Res() res: Response) {
        const auth = this.auth(req, streamId);
        if (!auth) {
            return res.status(403).send("Érvénytelen vagy lejárt stream token.");
        }

        const filePath = getHlsPlaylistFile(streamId);
        if (!(await pathExists(filePath))) {
            return res.status(404).send("A HLS playlist nem található.");
        }

        const playlist = await fsp.readFile(filePath, "utf8");
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.send(playlist);
    }

    @Get(":streamId/:segment")
    async getSegment(
        @Param("streamId") streamId: string,
        @Param("segment") segment: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        if (!this.auth(req, streamId)) {
            return res.status(403).send("Érvénytelen vagy lejárt stream token.");
        }

        if (!/\.(ts|m4s|mp4|m3u8)$/i.test(segment)) {
            return res.status(403).send("Érvénytelen HLS szegmens.");
        }

        const filePath = getHlsSegmentFile(streamId, segment);
        const fallback =
            segment === "archive.mp4" ? getHlsSegmentFile(streamId, "recording.mp4") : "";
        const resolved = (await pathExists(filePath))
            ? filePath
            : fallback && (await pathExists(fallback))
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
            res.setHeader("Cache-Control", "private, max-age=5");
        }

        return res.sendFile(resolved, { acceptRanges: true });
    }

    private auth(req: Request, streamId: string) {
        const ip = clientKey(req);
        const cookie = this.tokenService.decodeCookie(readCookie(req, HLS_COOKIE));
        const q = req.query || {};
        const token = String(q.token || (cookie?.streamId === streamId ? cookie.token : "") || "");
        const expiresAt = String(q.expiresAt || (cookie?.streamId === streamId ? cookie.expiresAt : "") || "");
        const userId = String(q.userId || (cookie?.streamId === streamId ? cookie.userId : "") || "");
        if (!this.tokenService.validateStreamToken(streamId, token, Number(expiresAt), userId, ip)) {
            return null;
        }
        return { token, userId, expiresAt: Number(expiresAt) };
    }
}

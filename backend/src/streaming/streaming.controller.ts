import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { promises as fsp } from "fs";
import { TokenService } from "../security/token/token.service";
import { getHlsPlaylistFile, getHlsSegmentFile } from "./hls-paths";
import { HLS_COOKIE } from "../security/http-guard";
import { clientKey } from "../security/rate-limit";
import { readCookie } from "../auth/auth.cookies";
import { pathExists } from "./fs-async";

@Controller("stream")
export class StreamingController {
    constructor(private readonly tokenService: TokenService) {}

    @Get(":id/index.m3u8")
    async getPlaylist(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
        if (!this.valid(req, id)) {
            return res.status(403).send("Invalid token");
        }
        const filePath = getHlsPlaylistFile(id);
        if (!(await pathExists(filePath))) {
            return res.status(404).send("A HLS playlist nem található.");
        }
        return res.send(await fsp.readFile(filePath, "utf8"));
    }

    @Get(":id/:segment")
    async getSegment(
        @Param("id") id: string,
        @Param("segment") segment: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        if (!this.valid(req, id)) {
            return res.status(403).send("Invalid token");
        }
        if (!/\.(ts|m4s|mp4|m3u8)$/i.test(segment)) {
            return res.status(403).send("Érvénytelen HLS szegmens.");
        }
        const filePath = getHlsSegmentFile(id, segment);
        if (!(await pathExists(filePath))) {
            return res.status(404).send("A HLS szegmens nem található.");
        }
        return res.sendFile(filePath);
    }

    private valid(req: Request, streamId: string) {
        const ip = clientKey(req);
        const cookie = this.tokenService.decodeCookie(readCookie(req, HLS_COOKIE));
        const q = req.query || {};
        const token = String(q.token || (cookie?.streamId === streamId ? cookie.token : "") || "");
        const expiresAt = String(q.expiresAt || (cookie?.streamId === streamId ? cookie.expiresAt : "") || "");
        const userId = String(q.userId || (cookie?.streamId === streamId ? cookie.userId : "") || "");
        return this.tokenService.validateStreamToken(streamId, token, Number(expiresAt), userId, ip);
    }
}

import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { TokenService } from "../security/token/token.service";
import * as fs from "fs";
import { getHlsPlaylistFile, getHlsSegmentFile } from "./hls-paths";

@Controller("stream")
export class StreamingController {
    constructor(private readonly tokenService: TokenService) {}

    @Get(":id/index.m3u8")
    async getPlaylist(
        @Param("id") id: string,
        @Query("token") token: string,
        @Query("expiresAt") expiresAt: string,
        @Query("userId") userId: string,
        @Res() res: Response,
    ) {
        if (!this.valid(id, token, expiresAt, userId)) {
            return res.status(403).send("Invalid token");
        }

        const filePath = getHlsPlaylistFile(id);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("A HLS playlist nem található.");
        }
        const playlist = fs.readFileSync(filePath, "utf8");
        const protectedPlaylist = playlist.replace(
            /\.ts/g,
            (match) =>
                `${match}?token=${token}&expiresAt=${expiresAt}&userId=${encodeURIComponent(userId)}`,
        );
        return res.send(protectedPlaylist);
    }

    @Get(":id/:segment")
    async getSegment(
        @Param("id") id: string,
        @Param("segment") segment: string,
        @Query("token") token: string,
        @Query("expiresAt") expiresAt: string,
        @Query("userId") userId: string,
        @Res() res: Response,
    ) {
        if (!this.valid(id, token, expiresAt, userId)) {
            return res.status(403).send("Invalid token");
        }

        const filePath = getHlsSegmentFile(id, segment);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("A HLS szegmens nem található.");
        }
        return res.sendFile(filePath);
    }

    private valid(id: string, token: string, expiresAt: string, userId: string) {
        const now = Math.floor(Date.now() / 1000);
        if (!expiresAt || Number(expiresAt) < now) return false;
        return this.tokenService.validateStreamToken(id, token, Number(expiresAt), userId);
    }
}

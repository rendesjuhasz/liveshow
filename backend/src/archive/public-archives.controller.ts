import { Controller, Get, Headers, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { ArchiveService } from "./archive.service";
import { OptionalJwtAuthGuard } from "../auth/jwt-auth.guard";
import { TokenService } from "../security/token/token.service";
import type { ArchiveSort } from "../stats/view-log.service";
import { HLS_COOKIE, isHttpsRequest } from "../security/http-guard";
import { clientKey } from "../security/rate-limit";

function parseArchiveSort(raw?: string): ArchiveSort {
    const value = String(raw || "newest").toLowerCase();
    if (value === "popular" || value === "views" || value === "oldest" || value === "newest") {
        return value;
    }
    return "newest";
}

@Controller("archives")
export class PublicArchivesController {
    constructor(
        private readonly archiveService: ArchiveService,
        private readonly tokens: TokenService,
    ) {}

    private lang(query?: string, header?: string, accept?: string) {
        return query || header || String(accept || "").slice(0, 2) || "hu";
    }

    @Get()
    list(
        @Query("lang") lang?: string,
        @Query("category") category?: string,
        @Query("sort") sort?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        return this.archiveService.listPublicArchives(
            this.lang(lang, header, accept),
            category,
            parseArchiveSort(sort),
        );
    }

    @Get("categories")
    categories() {
        return this.archiveService.listVideoCategories();
    }

    @Get(":showId/preview")
    @UseGuards(OptionalJwtAuthGuard)
    async preview(
        @Param("showId") showId: string,
        @Req() req: Request & { user?: { id?: string } },
        @Res({ passthrough: true }) res: Response,
    ) {
        const source = await this.archiveService.previewSource(showId);
        const signed = this.tokens.generateStreamToken(
            source.streamId,
            90,
            req.user?.id || "archive-preview",
            clientKey(req),
        );
        res.cookie(HLS_COOKIE, this.tokens.encodeCookie(signed), {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: "lax",
            path: "/",
            maxAge: 90_000,
        });
        return {
            showId: source.showId,
            streamId: source.streamId,
            hasTeaser: source.hasTeaser,
            clipSeconds: 12,
            url: source.publicPath,
            expiresAt: signed.expiresAt,
            cookie: true,
        };
    }

    @Get(":showId")
    getOne(
        @Param("showId") showId: string,
        @Query("lang") lang?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        return this.archiveService.getArchive(showId, { lang: this.lang(lang, header, accept) });
    }
}

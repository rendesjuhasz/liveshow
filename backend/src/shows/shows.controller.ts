import { Controller, Get, Headers, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ShowsService } from "./shows.service";

@Controller("shows")
export class ShowsController {
    constructor(private readonly showsService: ShowsService) {}

    private lang(query?: string, header?: string, accept?: string) {
        return query || header || String(accept || "").slice(0, 2) || "hu";
    }

    @Get()
    getAllShows(
        @Query("lang") lang?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        return this.showsService.getAllShows(this.lang(lang, header, accept));
    }

    @Get("featured")
    getFeaturedShows(
        @Query("lang") lang?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        return this.showsService.getFeaturedShows(this.lang(lang, header, accept));
    }

    @Get("live")
    getLiveShows(
        @Query("lang") lang?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        return this.showsService.getLiveShows(this.lang(lang, header, accept));
    }

    @Get("search")
    search(
        @Query("q") q?: string,
        @Query("category") category?: string,
        @Query("lang") lang?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        return this.showsService.searchShows(q || "", this.lang(lang, header, accept), category);
    }

    @Get("video-categories")
    videoCategories() {
        return this.showsService.listVideoCategories();
    }

    @Get(":id/tracks")
    tracks(@Param("id") id: string) {
        return this.showsService.listTracks(id);
    }

    @Get(":id/calendar.ics")
    async calendar(@Param("id") id: string, @Res() res: Response) {
        const { ics, filename } = await this.showsService.calendarIcs(id);
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(ics);
    }

    @Get(":id")
    getShowById(
        @Param("id") id: string,
        @Query("lang") lang?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        return this.showsService.getShowById(id, { lang: this.lang(lang, header, accept) });
    }
}

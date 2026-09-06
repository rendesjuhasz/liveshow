import { Controller, Get, Headers, Param, Query } from "@nestjs/common";
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

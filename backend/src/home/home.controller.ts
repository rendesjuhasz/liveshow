import { Controller, Get, Headers, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { HomeService } from "./home.service";

@Controller("home")
export class HomeController {
    constructor(private readonly home: HomeService) {}

    private lang(query?: string, header?: string, accept?: string) {
        return query || header || String(accept || "").slice(0, 2) || "hu";
    }

    @Get()
    async get(
        @Res({ passthrough: true }) res: Response,
        @Query("lang") lang?: string,
        @Headers("x-locale") header?: string,
        @Headers("accept-language") accept?: string,
    ) {
        const { body, hit, stats } = await this.home.get(this.lang(lang, header, accept));
        res.setHeader("X-Cache", hit ? "HIT" : "MISS");
        res.setHeader(
            "X-Cache-Stats",
            `hits=${stats.hits};misses=${stats.misses};coalesced=${stats.coalesced};hitRate=${stats.hitRate}`,
        );
        return body;
    }
}

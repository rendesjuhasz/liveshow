import { Body, Controller, Get, Headers, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { I18nService } from "./i18n.service";
import { I18nMissingDto } from "../dto/bodies";
import { assertRateLimit, clientKey } from "../security/rate-limit";

@Controller("i18n")
export class I18nController {
    constructor(private readonly i18n: I18nService) {}

    @Get("languages")
    languages() {
        return this.i18n.publicLanguages();
    }

    @Get("catalog")
    catalog(
        @Query("lang") lang?: string,
        @Headers("accept-language") accept?: string,
        @Headers("x-locale") headerLocale?: string,
    ) {
        return this.i18n.catalog(lang || headerLocale || this.i18n.resolveLocale(null, accept));
    }

    @Post("missing")
    async missing(@Req() req: Request, @Body() body: I18nMissingDto) {
        await assertRateLimit(`i18n-missing:${clientKey(req)}`, 20, 60_000);
        return this.i18n.logMissing(String(body.key || ""), String(body.locale || "hu"));
    }
}

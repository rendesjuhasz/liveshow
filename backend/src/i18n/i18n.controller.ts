import { Body, Controller, Get, Headers, Post, Query } from "@nestjs/common";
import { I18nService } from "./i18n.service";

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
    missing(@Body() body: { key?: string; locale?: string }) {
        return this.i18n.logMissing(String(body.key || ""), String(body.locale || "hu"));
    }
}

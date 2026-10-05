import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { I18nService } from "./i18n.service";
import { I18nContentDto, LanguageCreateDto, LanguageDto, MediaTrackDto, TranslationDto, TranslationKeyDto } from "../dto/bodies";

@Controller("admin/i18n")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
export class I18nAdminController {
    constructor(private readonly i18n: I18nService) {}

    @Get("languages")
    languages() {
        return this.i18n.allLanguages();
    }

    @Get("content")
    contentList(@Query("entityType") entityType: string, @Query("entityId") entityId: string) {
        return this.i18n.contentFor(entityType, entityId);
    }

    @Get("tracks/:showId")
    tracks(@Param("showId") showId: string) {
        return this.i18n.tracks(showId);
    }

    @Get("stats")
    stats() {
        return this.i18n.stats();
    }

    @Get("translations")
    list() {
        return this.i18n.listAdmin();
    }

    @Get("versions")
    versions(@Query("key") key: string, @Query("locale") locale: string) {
        return this.i18n.versions(key, locale);
    }

    @Post("translations")
    save(
        @Req() req: { user: { id: string } },
        @Body() body: TranslationDto,
    ) {
        return this.i18n.setUiTranslation({ ...body, userId: req.user.id });
    }

    @Post("translations/approve")
    approve(@Req() req: { user: { id: string } }, @Body() body: TranslationKeyDto) {
        return this.i18n.approve(body.key, body.locale, req.user.id);
    }

    @Post("content")
    content(
        @Body() body: I18nContentDto,
    ) {
        return this.i18n.setContent(body);
    }

    @Post("languages")
    addLanguage(@Body() body: LanguageCreateDto) {
        return this.i18n.upsertLanguage(body);
    }

    @Patch("languages/:code")
    toggle(@Param("code") code: string, @Body() body: LanguageDto) {
        if (body.name) return this.i18n.upsertLanguage({ code, name: body.name, nativeName: body.nativeName, enabled: body.enabled });
        return this.i18n.setLanguageEnabled(code, body.enabled !== false);
    }

    @Post("tracks/:showId")
    track(
        @Param("showId") showId: string,
        @Body() body: MediaTrackDto,
    ) {
        return this.i18n.saveTrack(showId, body);
    }
}

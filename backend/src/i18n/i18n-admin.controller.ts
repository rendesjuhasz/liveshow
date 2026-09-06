import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { I18nService } from "./i18n.service";

@Controller("admin/i18n")
@UseGuards(JwtAuthGuard, AdminGuard)
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
        @Body() body: { key: string; locale: string; value: string; status?: string },
    ) {
        return this.i18n.setUiTranslation({ ...body, userId: req.user.id });
    }

    @Post("translations/approve")
    approve(@Req() req: { user: { id: string } }, @Body() body: { key: string; locale: string }) {
        return this.i18n.approve(body.key, body.locale, req.user.id);
    }

    @Post("content")
    content(
        @Body()
        body: { entityType: string; entityId: string; field: string; locale: string; value: string },
    ) {
        return this.i18n.setContent(body);
    }

    @Post("languages")
    addLanguage(@Body() body: { code: string; name: string; nativeName?: string; enabled?: boolean }) {
        return this.i18n.upsertLanguage(body);
    }

    @Patch("languages/:code")
    toggle(@Param("code") code: string, @Body() body: { enabled?: boolean; name?: string; nativeName?: string }) {
        if (body.name) return this.i18n.upsertLanguage({ code, name: body.name, nativeName: body.nativeName, enabled: body.enabled });
        return this.i18n.setLanguageEnabled(code, body.enabled !== false);
    }

    @Post("tracks/:showId")
    track(
        @Param("showId") showId: string,
        @Body() body: { kind: string; locale: string; label: string; url: string; isDefault?: boolean },
    ) {
        return this.i18n.saveTrack(showId, body);
    }
}

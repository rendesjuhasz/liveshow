import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { MarketingService } from "./marketing.service";
import { MarketingGenerateDto, MarketingPublishDto, PatchMarketingKitDto, StreamIdDto } from "../dto/bodies";
import { publicFrontendUrl } from "../auth/public-url";

type Authed = { user: { id: string; email?: string; role?: string } };

@Controller("ai/marketing-kit")
export class MarketingController {
    constructor(private readonly marketing: MarketingService) {}

    @Post("generate")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    generate(@Req() req: Authed, @Body() body: MarketingGenerateDto) {
        const streamId = String(body?.streamId || "").trim();
        if (!streamId) throw new BadRequestException("A streamId kötelező.");
        return this.marketing.generate(req.user, streamId, String(body?.language || "hu"));
    }

    @Get("accounts")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    accounts(@Req() req: Authed) {
        return this.marketing.listAccounts(req.user);
    }

    @Delete("accounts/:id")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    disconnect(@Req() req: Authed, @Param("id") id: string) {
        return this.marketing.disconnectAccount(req.user, id);
    }

    @Post("oauth/:provider/start")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    oauthStart(
        @Req() req: Authed,
        @Param("provider") provider: string,
        @Body() body: StreamIdDto,
    ) {
        const showId = String(body?.showId || body?.streamId || "").trim();
        if (!showId) throw new BadRequestException("A streamId kötelező.");
        return this.marketing.oauthStart(req.user, provider, showId);
    }

    @Get("oauth/:provider/callback")
    async oauthCallback(
        @Param("provider") provider: string,
        @Query("code") code: string,
        @Query("state") state: string,
        @Query("error") error: string,
        @Res() res: Response,
    ) {
        if (error) {
            return res.redirect(302, `${front()}/streamer/shows?oauth=error`);
        }
        if (!code || !state) throw new BadRequestException("Hiányzó OAuth code/state.");
        const url = await this.marketing.oauthCallback(provider, code, state);
        return res.redirect(302, url);
    }

    @Patch(":kitId")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    patch(@Req() req: Authed, @Param("kitId") kitId: string, @Body() body: PatchMarketingKitDto) {
        return this.marketing.patchKit(req.user, kitId, { ...body } as Record<string, unknown>);
    }

    @Post(":kitId/publish")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    publish(
        @Req() req: Authed,
        @Param("kitId") kitId: string,
        @Body() body: MarketingPublishDto,
    ) {
        return this.marketing.enqueuePublish(req.user, kitId, body || {});
    }

    @Post("publish/:jobId/retry")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    retry(@Req() req: Authed, @Param("jobId") jobId: string) {
        return this.marketing.retryPublish(req.user, jobId);
    }

    @Get(":streamId/history")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    history(@Req() req: Authed, @Param("streamId") streamId: string) {
        return this.marketing.history(req.user, streamId);
    }

    @Get(":streamId")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    latest(@Req() req: Authed, @Param("streamId") streamId: string) {
        return this.marketing.latest(req.user, streamId);
    }
}

function front() {
    return publicFrontendUrl();
}

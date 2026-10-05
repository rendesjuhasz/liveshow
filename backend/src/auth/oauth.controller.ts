import {
    BadRequestException,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    Res,
    Body,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { OAuthService } from "./oauth.service";
import { isOAuthProvider } from "./oauth-link";
import { setAuthCookies } from "./auth.cookies";
import { publicFrontendUrl } from "./public-url";
import { assertRateLimit, clientKey } from "../security/rate-limit";

@Controller("auth/oauth")
export class OAuthController {
    constructor(private readonly oauth: OAuthService) {}

    @Get("status")
    status() {
        return this.oauth.configured();
    }

    @Get(":provider")
    async start(
        @Req() req: Request,
        @Res() res: Response,
        @Param("provider") providerRaw: string,
        @Query("next") next?: string,
    ) {
        await assertRateLimit(`oauth-start:${clientKey(req)}`, 20, 15 * 60_000);
        const provider = String(providerRaw || "").toLowerCase();
        if (!isOAuthProvider(provider)) {
            throw new BadRequestException("Ismeretlen belépési mód.");
        }
        try {
            const url = this.oauth.startUrl(provider, next);
            return res.redirect(url);
        } catch (err) {
            return res.redirect(this.failUrl(err));
        }
    }

    @Get(":provider/callback")
    async callbackGet(
        @Req() req: Request,
        @Res() res: Response,
        @Param("provider") providerRaw: string,
        @Query("code") code?: string,
        @Query("state") state?: string,
        @Query("error") error?: string,
    ) {
        return this.finish(req, res, providerRaw, { code, state, error });
    }

    @Post("apple/callback")
    async callbackApplePost(
        @Req() req: Request,
        @Res() res: Response,
        @Body() body: { code?: string; state?: string; error?: string; user?: string },
    ) {
        return this.finish(req, res, "apple", body || {});
    }

    @Post(":provider/callback")
    async callbackPost(
        @Req() req: Request,
        @Res() res: Response,
        @Param("provider") providerRaw: string,
        @Body() body: { code?: string; state?: string; error?: string; user?: string },
    ) {
        return this.finish(req, res, providerRaw, body || {});
    }

    private async finish(
        req: Request,
        res: Response,
        providerRaw: string,
        payload: { code?: string; state?: string; error?: string; user?: string },
    ) {
        await assertRateLimit(`oauth-cb:${clientKey(req)}`, 30, 15 * 60_000);
        const provider = String(providerRaw || "").toLowerCase();
        if (!isOAuthProvider(provider)) {
            return res.redirect(this.failUrl("Ismeretlen belépési mód."));
        }
        try {
            const { session, next } = await this.oauth.finish(provider, payload);
            setAuthCookies(req, res, session);
            const dest = next.startsWith("/") ? next : "/";
            return res.redirect(`${publicFrontendUrl()}${dest}`);
        } catch (err) {
            return res.redirect(this.failUrl(err));
        }
    }

    private failUrl(err: unknown) {
        const message =
            err && typeof err === "object" && "message" in err
                ? String((err as { message?: string }).message || "")
                : "";
        const safe = message.slice(0, 180) || "A social belépés nem sikerült.";
        return `${publicFrontendUrl()}/login?oauthError=${encodeURIComponent(safe)}`;
    }
}

import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "./jwt-auth.guard";
import { EmailVerifiedGuard } from "./email-verified.guard";
import { assertRateLimit, clientKey } from "../security/rate-limit";
import { assertUploadedMedia } from "../uploads/upload-magic";
import {
    ClaimUsernameDto,
    ForgotPasswordDto,
    LoginDto,
    RegisterDto,
    ResendVerificationDto,
    ResetPasswordDto,
    TotpCodeDto,
    TotpDisableDto,
    VerifyEmailDto,
} from "./auth.dto";
import { AuthProfileDto, RegisterStreamerDto } from "../dto/bodies";
import { clearAuthCookies, readCookie, REFRESH_COOKIE, setAuthCookies, setCsrfCookie } from "./auth.cookies";
import { newOpaqueToken } from "./secrets";
import { CSRF_COOKIE } from "../security/http-guard";

const AVATAR_DIR = join(process.cwd(), "uploads", "avatars");

function avatarStorage() {
    if (!existsSync(AVATAR_DIR)) {
        mkdirSync(AVATAR_DIR, { recursive: true });
    }
    return diskStorage({
        destination: AVATAR_DIR,
        filename: (_req: unknown, file: { originalname: string }, cb: (error: Error | null, filename: string) => void) => {
            const ext = extname(file.originalname || "").toLowerCase() || ".jpg";
            cb(null, `${randomUUID()}${ext}`);
        },
    });
}

function publicSession(session: {
    token: string;
    csrfToken: string;
    expiresAt: number;
    user: unknown;
    streamer?: unknown;
}) {
    return {
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
        user: session.user,
        streamer: session.streamer,
    };
}

@Controller("auth")
export class AuthController {
    constructor(private authService: AuthService) {}

    @Post("register")
    async register(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: RegisterDto,
    ) {
        await assertRateLimit(`reg:${clientKey(req)}`, 8, 15 * 60_000);
        const session = await this.authService.register(
            body.email,
            body.password,
            body.name,
            body.referralCode,
            body.locale,
            body.username,
        );
        setAuthCookies(req, res, session);
        return publicSession(session);
    }

    @Post("register-streamer")
    @UseInterceptors(
        FileInterceptor("avatar", {
            storage: avatarStorage(),
            limits: { fileSize: 5 * 1024 * 1024 },
            fileFilter: (_req, file, cb) => {
                const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
                    file.mimetype,
                );
                if (!ok) {
                    cb(new BadRequestException("A profilkép JPEG, PNG, WebP vagy GIF legyen."), false);
                    return;
                }
                cb(null, true);
            },
        }),
    )
    async registerStreamer(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @UploadedFile() file: { filename?: string; mimetype?: string; path?: string } | undefined,
        @Body() body: RegisterStreamerDto,
    ) {
        if (!file?.filename) {
            throw new BadRequestException("A profilkép kötelező.");
        }
        assertUploadedMedia(file.path || join(AVATAR_DIR, file.filename), String(file.mimetype || ""), "image");

        const accepted = String(body.termsAccepted || "").toLowerCase();
        await assertRateLimit(`reg-st:${clientKey(req)}`, 8, 15 * 60_000);
        const session = await this.authService.registerStreamer({
            name: body.name || "",
            email: body.email || "",
            password: body.password || "",
            username: body.username || "",
            bio: body.bio || "",
            category: body.category || "",
            contactEmail: body.contactEmail || "",
            termsAccepted: accepted === "true" || accepted === "on" || accepted === "1",
            avatarUrl: `/uploads/avatars/${file.filename}`,
            locale: body.locale,
        });
        setAuthCookies(req, res, session);
        return publicSession(session);
    }

    @Post("login")
    async login(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: LoginDto,
    ) {
        const ip = clientKey(req);
        await assertRateLimit(`login:${ip}`, 8, 15 * 60_000);
        await assertRateLimit(`login-email:${String(body.email || "").trim().toLowerCase()}`, 5, 15 * 60_000);
        const session = await this.authService.login(body.email, body.password);
        setAuthCookies(req, res, session);
        return publicSession(session);
    }

    @Post("refresh")
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const session = await this.authService.refreshSession(readCookie(req, REFRESH_COOKIE));
        setAuthCookies(req, res, session);
        return publicSession(session);
    }

    @Post("logout")
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        await this.authService.logoutRefresh(readCookie(req, REFRESH_COOKIE));
        clearAuthCookies(req, res);
        return { ok: true };
    }

    @Post("forgot-password")
    async forgotPassword(@Req() req: Request, @Body() body: ForgotPasswordDto) {
        await assertRateLimit(`forgot:${clientKey(req)}`, 8, 15 * 60_000);
        return this.authService.forgotPassword(body?.email);
    }

    @Post("reset-password")
    async resetPassword(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: ResetPasswordDto,
    ) {
        await assertRateLimit(`reset:${clientKey(req)}`, 12, 15 * 60_000);
        const session = await this.authService.resetPassword(body?.token, body?.password, body?.passwordConfirm);
        setAuthCookies(req, res, session);
        return publicSession(session);
    }

    @Post("verify-email")
    async verifyEmail(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: VerifyEmailDto,
    ) {
        await assertRateLimit(`verify:${clientKey(req)}`, 12, 15 * 60_000);
        const session = await this.authService.verifyEmail(body?.token);
        setAuthCookies(req, res, session);
        return publicSession(session);
    }

    @Post("resend-verification")
    @UseGuards(OptionalJwtAuthGuard)
    async resendVerification(
        @Req() req: Request & { user?: { id?: string } },
        @Body() body: ResendVerificationDto,
    ) {
        await assertRateLimit(`resend-verify:${clientKey(req)}`, 5, 15 * 60_000);
        return this.authService.resendVerification(req.user?.id, body?.email);
    }

    @Get("csrf")
    csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        let token = readCookie(req, CSRF_COOKIE);
        if (!token) {
            token = newOpaqueToken();
            setCsrfCookie(req, res, token);
        }
        return { csrfToken: token };
    }

    @Get("me")
    @UseGuards(JwtAuthGuard)
    me(@Req() req: { user: { id: string; email: string; role: string } }) {
        return this.authService.getMe(req.user.id);
    }

    @Post("username")
    @UseGuards(JwtAuthGuard)
    claimUsername(
        @Req() req: { user: { id: string } },
        @Body() body: ClaimUsernameDto,
    ) {
        return this.authService.claimUsername(req.user.id, body.username);
    }

    @Get("ws-ticket")
    @UseGuards(JwtAuthGuard)
    async wsTicket(@Req() req: Request & { user: { id: string } }) {
        await assertRateLimit(`ws-ticket:${clientKey(req)}`, 30, 60_000);
        return this.authService.issueWsTicket(req.user.id);
    }

    @Patch("profile")
    @UseGuards(JwtAuthGuard)
    updateProfile(@Req() req: { user: { id: string } }, @Body() body: AuthProfileDto) {
        return this.authService.updateProfile(req.user.id, body);
    }

    @Get("2fa/status")
    @UseGuards(JwtAuthGuard)
    totpStatus(@Req() req: { user: { id: string } }) {
        return this.authService.totpStatus(req.user.id);
    }

    @Post("2fa/setup")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    totpSetup(@Req() req: { user: { id: string } }) {
        return this.authService.totpSetup(req.user.id);
    }

    @Post("2fa/confirm")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    totpConfirm(@Req() req: { user: { id: string } }, @Body() body: TotpCodeDto) {
        return this.authService.totpConfirm(req.user.id, body.code);
    }

    @Post("2fa/disable")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    totpDisable(@Req() req: { user: { id: string } }, @Body() body: TotpDisableDto) {
        return this.authService.totpDisable(req.user.id, body.password, body.code);
    }
}

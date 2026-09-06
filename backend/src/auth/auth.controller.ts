import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { assertRateLimit, clientKey } from "../security/rate-limit";

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

@Controller("auth")
export class AuthController {
    constructor(private authService: AuthService) {}

    @Post("register")
    register(
        @Req() req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
        @Body() body: { email: string; password: string; name?: string; referralCode?: string; locale?: string },
    ) {
        assertRateLimit(`reg:${clientKey(req)}`, 8, 15 * 60_000);
        return this.authService.register(body.email, body.password, body.name, body.referralCode, body.locale);
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
    registerStreamer(
        @Req() req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
        @UploadedFile() file: { filename?: string } | undefined,
        @Body()
        body: {
            name?: string;
            email?: string;
            password?: string;
            bio?: string;
            category?: string;
            contactEmail?: string;
            termsAccepted?: string;
        },
    ) {
        if (!file?.filename) {
            throw new BadRequestException("A profilkép kötelező.");
        }

        const accepted = String(body.termsAccepted || "").toLowerCase();
        assertRateLimit(`reg-st:${clientKey(req)}`, 8, 15 * 60_000);
        return this.authService.registerStreamer({
            name: body.name || "",
            email: body.email || "",
            password: body.password || "",
            bio: body.bio || "",
            category: body.category || "",
            contactEmail: body.contactEmail || "",
            termsAccepted: accepted === "true" || accepted === "on" || accepted === "1",
            avatarUrl: `/uploads/avatars/${file.filename}`,
        });
    }

    @Post("login")
    login(@Req() req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } }, @Body() body: { email: string; password: string }) {
        assertRateLimit(`login:${clientKey(req)}`, 20, 15 * 60_000);
        return this.authService.login(body.email, body.password);
    }

    @Post("forgot-password")
    forgotPassword(
        @Req() req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
        @Body() body: { email?: string },
    ) {
        assertRateLimit(`forgot:${clientKey(req)}`, 8, 15 * 60_000);
        return this.authService.forgotPassword(body?.email);
    }

    @Post("reset-password")
    resetPassword(
        @Req() req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
        @Body() body: { token?: string; password?: string; passwordConfirm?: string },
    ) {
        assertRateLimit(`reset:${clientKey(req)}`, 12, 15 * 60_000);
        return this.authService.resetPassword(body?.token, body?.password, body?.passwordConfirm);
    }

    @Get("me")
    @UseGuards(JwtAuthGuard)
    me(@Req() req: { user: { id: string; email: string; role: string } }) {
        return this.authService.getMe(req.user.id);
    }

    @Patch("profile")
    @UseGuards(JwtAuthGuard)
    updateProfile(
        @Req() req: { user: { id: string } },
        @Body() body: { name?: string; locale?: string },
    ) {
        return this.authService.updateProfile(req.user.id, body);
    }
}

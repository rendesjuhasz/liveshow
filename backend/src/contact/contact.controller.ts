import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { ContactService } from "./contact.service";
import { ContactAdminPatchDto, ContactDto } from "../dto/bodies";
import { assertRateLimit, clientKey } from "../security/rate-limit";

@Controller()
export class ContactController {
    constructor(private readonly contact: ContactService) {}

    @Post("api/contact")
    async submit(
        @Req() req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
        @Body() body: ContactDto,
    ) {
        await assertRateLimit(`contact:${clientKey(req)}`, 5, 15 * 60_000);
        return this.contact.submit(body);
    }

    @Get("admin/contact")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    list(
        @Query("status") status?: string,
        @Query("q") q?: string,
        @Query("page") page?: string,
        @Query("pageSize") pageSize?: string,
    ) {
        return this.contact.list({ status, q, page, pageSize });
    }

    @Patch("admin/contact/:id")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    update(@Param("id") id: string, @Body() body: ContactAdminPatchDto) {
        return this.contact.update(id, body);
    }
}

import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { ContactService } from "./contact.service";
import { assertRateLimit, clientKey } from "../security/rate-limit";

@Controller()
export class ContactController {
    constructor(private readonly contact: ContactService) {}

    @Post("api/contact")
    submit(
        @Req() req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
        @Body() body: { name?: string; email?: string; message?: string },
    ) {
        assertRateLimit(`contact:${clientKey(req)}`, 5, 15 * 60_000);
        return this.contact.submit(body);
    }

    @Get("admin/contact")
    @UseGuards(JwtAuthGuard, AdminGuard)
    list() {
        return this.contact.list();
    }
}

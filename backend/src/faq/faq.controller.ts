import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { FaqService } from "./faq.service";
import { FaqDto } from "../dto/bodies";

@Controller()
export class FaqController {
    constructor(private readonly faq: FaqService) {}

    @Get("faq")
    listPublic() {
        return this.faq.listPublic();
    }

    @Get("admin/faq")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    listAll() {
        return this.faq.listAll();
    }

    @Post("admin/faq")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    create(
        @Body() body: FaqDto,
    ) {
        return this.faq.create(body);
    }

    @Patch("admin/faq/:id")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    update(
        @Param("id") id: string,
        @Body() body: FaqDto,
    ) {
        return this.faq.update(id, body);
    }

    @Delete("admin/faq/:id")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    remove(@Param("id") id: string) {
        return this.faq.remove(id);
    }
}

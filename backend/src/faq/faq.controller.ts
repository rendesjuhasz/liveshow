import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { FaqService } from "./faq.service";

@Controller()
export class FaqController {
    constructor(private readonly faq: FaqService) {}

    @Get("faq")
    listPublic() {
        return this.faq.listPublic();
    }

    @Get("admin/faq")
    @UseGuards(JwtAuthGuard, AdminGuard)
    listAll() {
        return this.faq.listAll();
    }

    @Post("admin/faq")
    @UseGuards(JwtAuthGuard, AdminGuard)
    create(
        @Body()
        body: {
            category?: string;
            question?: string;
            answer?: string;
            order?: number;
            isPublished?: boolean;
        },
    ) {
        return this.faq.create(body);
    }

    @Patch("admin/faq/:id")
    @UseGuards(JwtAuthGuard, AdminGuard)
    update(
        @Param("id") id: string,
        @Body()
        body: {
            category?: string;
            question?: string;
            answer?: string;
            order?: number;
            isPublished?: boolean;
        },
    ) {
        return this.faq.update(id, body);
    }

    @Delete("admin/faq/:id")
    @UseGuards(JwtAuthGuard, AdminGuard)
    remove(@Param("id") id: string) {
        return this.faq.remove(id);
    }
}

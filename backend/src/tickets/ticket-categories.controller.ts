import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { TicketGroupsService } from "./ticket-groups.service";
import { CatalogItemsDto } from "../dto/bodies";

@Controller()
export class TicketCategoriesController {
    constructor(private readonly groups: TicketGroupsService) {}

    @Get("ticket-packs")
    packs() {
        return this.groups.listCatalog();
    }

    @Put("admin/ticket-packs")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    savePacks(
        @Body() body: CatalogItemsDto,
    ) {
        return this.groups.saveCatalog(body.items || []);
    }

    @Get("ticket-categories")
    list() {
        return this.groups.listCatalog();
    }

    @Put("admin/ticket-categories")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    update(
        @Body() body: CatalogItemsDto,
    ) {
        return this.groups.saveCatalog(body.items || []);
    }
}

import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { TicketGroupsService } from "./ticket-groups.service";

@Controller()
export class TicketCategoriesController {
    constructor(private readonly groups: TicketGroupsService) {}

    @Get("ticket-packs")
    packs() {
        return this.groups.listCatalog();
    }

    @Put("admin/ticket-packs")
    @UseGuards(JwtAuthGuard, AdminGuard)
    savePacks(
        @Body() body: { items?: { key?: string; name?: string; ticketCount?: number; price?: number }[] },
    ) {
        return this.groups.saveCatalog(body.items || []);
    }

    @Get("ticket-categories")
    list() {
        return this.groups.listCatalog();
    }

    @Put("admin/ticket-categories")
    @UseGuards(JwtAuthGuard, AdminGuard)
    update(
        @Body() body: { items?: { key?: string; name?: string; ticketCount?: number; price?: number }[] },
    ) {
        return this.groups.saveCatalog(body.items || []);
    }
}

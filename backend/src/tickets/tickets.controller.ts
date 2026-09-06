import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TicketsService } from "./tickets.service";
import { TicketGroupsService } from "./ticket-groups.service";

@Controller("tickets")
@UseGuards(JwtAuthGuard)
export class TicketsController {
    constructor(
        private readonly ticketsService: TicketsService,
        private readonly groupsService: TicketGroupsService,
    ) {}

    @Post("buy")
    buy(
        @Req() req: { user: { id: string } },
        @Body() body: { showId?: string; categoryKey?: string },
    ) {
        return this.ticketsService.buy(req.user.id, body?.showId, body?.categoryKey);
    }

    @Get("groups")
    groups() {
        return this.groupsService.listCatalog();
    }

    @Get("balance")
    balance(@Req() req: { user: { id: string } }) {
        return this.groupsService.balance(req.user.id);
    }

    @Post("packs")
    buyPack(
        @Req() req: { user: { id: string } },
        @Body() body: { groupKey?: string },
    ) {
        return this.groupsService.buy(req.user.id, body?.groupKey);
    }

    @Get("my")
    my(@Req() req: { user: { id: string } }) {
        return this.ticketsService.listMine(req.user.id);
    }

    @Get("mine")
    mine(@Req() req: { user: { id: string } }) {
        return this.ticketsService.listMine(req.user.id);
    }

    @Get("show/:showId")
    forShow(
        @Req() req: { user: { id: string } },
        @Param("showId") showId: string,
    ) {
        return this.ticketsService.getForShow(req.user.id, showId);
    }
}

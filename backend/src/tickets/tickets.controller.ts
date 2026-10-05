import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { TicketsService } from "./tickets.service";
import { TicketGroupsService } from "./ticket-groups.service";
import { TicketPackBuyDto } from "../dto/bodies";
import { assertRateLimit } from "../security/rate-limit";

@Controller("tickets")
@UseGuards(JwtAuthGuard)
export class TicketsController {
    constructor(
        private readonly ticketsService: TicketsService,
        private readonly groupsService: TicketGroupsService,
    ) {}

    @Post("buy")
    @UseGuards(EmailVerifiedGuard)
    buy() {
        return this.ticketsService.buy("", "");
    }

    @Get("groups")
    groups() {
        return this.groupsService.listCatalog();
    }

    @Get("balance")
    balance(@Req() req: { user: { id: string } }, @Query("showId") showId?: string) {
        return this.groupsService.balance(req.user.id, showId);
    }

    @Post("packs")
    @UseGuards(EmailVerifiedGuard)
    buyPack(
        @Req() req: { user: { id: string } },
        @Body() body: TicketPackBuyDto,
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

    @Post(":id/resend")
    @UseGuards(EmailVerifiedGuard)
    async resend(@Req() req: { user: { id: string } }, @Param("id") id: string) {
        await assertRateLimit(`ticket-resend:${req.user.id}`, 5, 60 * 60_000);
        return this.ticketsService.resendPurchaseEmail(req.user.id, id, false);
    }
}

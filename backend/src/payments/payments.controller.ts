import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Get("barion/status")
    barionStatus(@Query("paymentId") paymentId: string) {
        return this.paymentsService.getBarionStatus(paymentId);
    }

    @Post("confirm-dev")
    @UseGuards(JwtAuthGuard)
    confirmDev(
        @Req() req: { user: { id: string } },
        @Body() body: { ticketId?: string; packPurchaseId?: string },
    ) {
        return this.paymentsService.confirmDev(
            req.user.id,
            String(body?.ticketId || ""),
            body?.packPurchaseId,
        );
    }

    @Post("confirm-stripe")
    @UseGuards(JwtAuthGuard)
    confirmStripe(@Req() req: { user: { id: string } }, @Body() body: { sessionId?: string }) {
        return this.paymentsService.confirmStripeSession(String(body?.sessionId || ""), req.user.id);
    }

    @Get()
    @UseGuards(JwtAuthGuard, AdminGuard)
    list() {
        return this.paymentsService.listAll();
    }
}

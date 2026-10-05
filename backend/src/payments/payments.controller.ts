import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { PaymentsService } from "./payments.service";
import { CancelPaymentDto, ConfirmDevPayDto, SessionIdDto } from "../dto/bodies";

@Controller("payments")
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Get("barion/status")
    @UseGuards(JwtAuthGuard)
    barionStatus(
        @Req() req: { user: { id: string; email?: string; role?: string } },
        @Query("paymentId") paymentId: string,
    ) {
        return this.paymentsService.getBarionStatus(paymentId, req.user);
    }

    @Post("stripe/webhook")
    stripeWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers("stripe-signature") signature: string,
    ) {
        const raw = req.rawBody;
        if (!raw || !signature) {
            throw new BadRequestException("Hiányzik a Stripe aláírás vagy a kérés törzse.");
        }
        return this.paymentsService.handleStripeWebhook(raw, signature);
    }

    @Post("confirm-dev")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    confirmDev(
        @Req() req: { user: { id: string } },
        @Body() body: ConfirmDevPayDto,
    ) {
        return this.paymentsService.confirmDev(
            req.user.id,
            String(body?.ticketId || ""),
            body?.packPurchaseId,
        );
    }

    @Post("confirm-stripe")
    @UseGuards(JwtAuthGuard)
    confirmStripe(@Req() req: { user: { id: string } }, @Body() body: SessionIdDto) {
        return this.paymentsService.confirmStripeSession(String(body?.sessionId || ""), req.user.id);
    }

    @Post("cancel")
    @UseGuards(JwtAuthGuard)
    cancel(
        @Req() req: { user: { id: string } },
        @Body() body: CancelPaymentDto,
    ) {
        return this.paymentsService.cancelStripeCheckout(req.user.id, body?.sessionId, body?.ticketId);
    }

    @Post(":id/refund")
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    refund(@Param("id") id: string) {
        return this.paymentsService.refundPayment(id);
    }

    @Get()
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
    list() {
        return this.paymentsService.listAll();
    }
}

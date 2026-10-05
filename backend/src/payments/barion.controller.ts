import { Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";
import { assertBarionWebhook } from "./barion-webhook.guard";

@Controller("api/barion")
export class BarionController {
    constructor(private readonly payments: PaymentsService) {}

    @Get("webhook")
    getWebhook(
        @Req() req: Request,
        @Query("PaymentId") paymentId: string,
        @Query("paymentId") alt: string,
    ) {
        const id = paymentId || alt;
        assertBarionWebhook(req, id);
        return this.payments.handleBarionWebhook(id);
    }

    @Post("webhook")
    postWebhook(
        @Req() req: Request,
        @Query("PaymentId") qid: string,
        @Query("paymentId") qid2: string,
    ) {
        const body = (req.body || {}) as Record<string, unknown>;
        const paymentId =
            qid ||
            qid2 ||
            body.PaymentId ||
            body.paymentId ||
            body.payment_id;
        const id = String(paymentId || "");
        assertBarionWebhook(req, id);
        return this.payments.handleBarionWebhook(id);
    }
}

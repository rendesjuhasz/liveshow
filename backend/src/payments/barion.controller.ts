import { Controller, Get, Post, Query, Req } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

@Controller("api/barion")
export class BarionController {
    constructor(private readonly payments: PaymentsService) {}

    @Get("webhook")
    getWebhook(@Query("PaymentId") paymentId: string, @Query("paymentId") alt: string) {
        return this.payments.handleBarionWebhook(paymentId || alt);
    }

    @Post("webhook")
    postWebhook(
        @Query("PaymentId") qid: string,
        @Query("paymentId") qid2: string,
        @Req() req: { body?: any },
    ) {
        const body = req.body || {};
        const paymentId =
            qid ||
            qid2 ||
            body.PaymentId ||
            body.paymentId ||
            body.payment_id;
        return this.payments.handleBarionWebhook(String(paymentId || ""));
    }
}

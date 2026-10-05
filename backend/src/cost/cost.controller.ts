import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { CostService } from "./cost.service";
import { CostRatesDto } from "../dto/bodies";

@Controller("admin/costs")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
export class CostController {
    constructor(private readonly costs: CostService) {}

    @Get()
    report() {
        return this.costs.report();
    }

    @Put()
    save(@Body() body: CostRatesDto) {
        return this.costs.saveRates(body);
    }
}

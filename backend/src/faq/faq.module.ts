import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { FaqController } from "./faq.controller";
import { FaqService } from "./faq.service";

@Module({
    imports: [PrismaModule, AdminGuardModule],
    controllers: [FaqController],
    providers: [FaqService],
    exports: [FaqService],
})
export class FaqModule {}

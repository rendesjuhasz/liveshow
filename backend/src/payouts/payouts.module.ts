import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PayoutsService } from "./payouts.service";

@Module({
    imports: [PrismaModule],
    providers: [PayoutsService],
    exports: [PayoutsService],
})
export class PayoutsModule {}

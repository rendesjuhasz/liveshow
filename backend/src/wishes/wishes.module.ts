import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StreamersModule } from "../streamers/streamers.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { WishesController } from "./wishes.controller";
import { WishesService } from "./wishes.service";

@Module({
    imports: [PrismaModule, StreamersModule, AuthGuardModule],
    controllers: [WishesController],
    providers: [WishesService],
})
export class WishesModule {}

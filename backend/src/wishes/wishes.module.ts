import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StreamersModule } from "../streamers/streamers.module";
import { WishesController } from "./wishes.controller";
import { WishesService } from "./wishes.service";

@Module({
    imports: [PrismaModule, StreamersModule],
    controllers: [WishesController],
    providers: [WishesService],
})
export class WishesModule {}

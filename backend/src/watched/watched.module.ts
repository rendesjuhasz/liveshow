import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WatchedController } from "./watched.controller";
import { WatchedService } from "./watched.service";

@Module({
    imports: [PrismaModule],
    controllers: [WatchedController],
    providers: [WatchedService],
})
export class WatchedModule {}

import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { FollowsController } from "./follows.controller";
import { FollowsService } from "./follows.service";
import { FollowNotifyService } from "./follow-notify.service";

@Global()
@Module({
    imports: [PrismaModule],
    controllers: [FollowsController],
    providers: [FollowsService, FollowNotifyService],
    exports: [FollowsService, FollowNotifyService],
})
export class FollowsModule {}

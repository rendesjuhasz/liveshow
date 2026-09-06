import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuard } from "./admin.guard";

@Module({
    imports: [PrismaModule],
    providers: [AdminGuard],
    exports: [AdminGuard],
})
export class AdminGuardModule {}

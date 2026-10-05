import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { AdminGuard } from "./admin.guard";

@Module({
    imports: [PrismaModule, AuthGuardModule],
    providers: [AdminGuard],
    exports: [AdminGuard, AuthGuardModule],
})
export class AdminGuardModule {}

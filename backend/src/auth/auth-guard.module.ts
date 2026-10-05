import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailVerifiedGuard } from "./email-verified.guard";

@Module({
    imports: [PrismaModule],
    providers: [EmailVerifiedGuard],
    exports: [EmailVerifiedGuard],
})
export class AuthGuardModule {}

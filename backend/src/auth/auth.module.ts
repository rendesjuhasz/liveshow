import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

import { PrismaModule } from "../prisma/prisma.module";
import { TicketsModule } from "../tickets/tickets.module";
import { ReferralModule } from "../referrals/referral.module";
import { jwtSecret } from "./secrets";

@Module({
    imports: [
        PrismaModule,
        TicketsModule,
        ReferralModule,
        PassportModule,
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: jwtSecret(),
                signOptions: { expiresIn: "7d" },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
})
export class AuthModule {}

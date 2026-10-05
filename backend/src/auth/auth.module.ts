import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { OAuthController } from "./oauth.controller";
import { OAuthService } from "./oauth.service";

import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuardModule } from "./auth-guard.module";
import { TicketsModule } from "../tickets/tickets.module";
import { ReferralModule } from "../referrals/referral.module";
import { jwtSecret } from "./secrets";

@Module({
    imports: [
        PrismaModule,
        AuthGuardModule,
        TicketsModule,
        ReferralModule,
        PassportModule,
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: jwtSecret(),
                signOptions: { expiresIn: "1h" },
            }),
        }),
    ],
    controllers: [AuthController, OAuthController],
    providers: [AuthService, JwtStrategy, OAuthService],
})
export class AuthModule {}

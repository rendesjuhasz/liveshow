import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { jwtSecret } from "./secrets";
import { WsAuthService } from "./ws-auth.service";

@Module({
    imports: [
        PrismaModule,
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: jwtSecret(),
                signOptions: { expiresIn: "1h" },
            }),
        }),
    ],
    providers: [WsAuthService],
    exports: [WsAuthService],
})
export class WsAuthModule {}

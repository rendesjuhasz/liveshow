import { Module } from "@nestjs/common";
import { TokenService } from "./token/token.service";
import { TokenController } from "./token/token.controller";
import { TicketsModule } from "../tickets/tickets.module";

@Module({
    imports: [TicketsModule],
    controllers: [TokenController],
    providers: [TokenService],
    exports: [TokenService],
})
export class SecurityModule {}

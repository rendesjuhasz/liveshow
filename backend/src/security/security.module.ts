import { Module } from "@nestjs/common";
import { TokenService } from "./token/token.service";
import { TokenController } from "./token/token.controller";
import { TicketsModule } from "../tickets/tickets.module";
import { MediaController } from "../uploads/media.controller";

@Module({
    imports: [TicketsModule],
    controllers: [TokenController, MediaController],
    providers: [TokenService],
    exports: [TokenService],
})
export class SecurityModule {}

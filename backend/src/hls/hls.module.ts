import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module";
import { HlsController } from "./hls.controller";

@Module({
    imports: [SecurityModule],
    controllers: [HlsController],
})
export class HlsModule {}

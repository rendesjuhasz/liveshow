import { Module } from "@nestjs/common";
import { LiveVideoSessionService } from "./live-video-session";

@Module({
    providers: [LiveVideoSessionService],
    exports: [LiveVideoSessionService],
})
export class LiveVideoSessionModule {}

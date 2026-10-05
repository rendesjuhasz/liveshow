import { Module } from "@nestjs/common";
import { ShowsModule } from "../shows/shows.module";
import { ArchiveModule } from "../archive/archive.module";
import { FaqModule } from "../faq/faq.module";
import { HomeController } from "./home.controller";
import { HomeService } from "./home.service";

@Module({
    imports: [ShowsModule, ArchiveModule, FaqModule],
    controllers: [HomeController],
    providers: [HomeService],
})
export class HomeModule {}

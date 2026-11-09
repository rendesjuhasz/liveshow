import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { SignedMediaInterceptor } from "./uploads/signed-media.interceptor";
import { UsernameRequiredInterceptor } from "./auth/username.interceptor";

import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { StreamersModule } from "./streamers/streamers.module";
import { ShowsModule } from "./shows/shows.module";
import { TicketsModule } from "./tickets/tickets.module";
import { PaymentsModule } from "./payments/payments.module";
import { QuestionsModule } from "./questions/questions.module";
import { ArchiveModule } from "./archive/archive.module";
import { StreamingModule } from "./streaming/streaming.module";
import { AdminModule } from "./admin/admin.module";

import { IngestModule } from "./ingest/ingest.module";
import { SecurityModule } from "./security/security.module";
import { HlsModule } from "./hls/hls.module";
import { StatsModule } from "./stats/stats.module";
import { ContactModule } from "./contact/contact.module";
import { FaqModule } from "./faq/faq.module";
import { WishesModule } from "./wishes/wishes.module";
import { ReferralModule } from "./referrals/referral.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { I18nModule } from "./i18n/i18n.module";
import { PrivateStreamsModule } from "./private-streams/private-streams.module";
import { FollowsModule } from "./follows/follows.module";
import { BackupModule } from "./backup/backup.module";
import { OpsModule } from "./ops/ops.module";
import { CostModule } from "./cost/cost.module";
import { MarketingModule } from "./marketing/marketing.module";
import { AlertsModule } from "./alerts/alerts.module";
import { WebrtcModule } from "./webrtc-signaling/webrtc.module";
import { ModerationModule } from "./moderation/moderation.module";
import { PreflightModule } from "./preflight/preflight.module";
import { PublicCacheModule } from "./cache/public-cache.module";
import { HomeModule } from "./home/home.module";
import { LivekitModule } from "./livekit/livekit.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { securityMiddleware } from "./security/http-guard";

@Module({
    imports: [
        PublicCacheModule,
        MailModule,
        AuthModule,
        UsersModule,
        FollowsModule,
        StreamersModule,
        ShowsModule,
        TicketsModule,
        PaymentsModule,
        QuestionsModule,
        ArchiveModule,
        StreamingModule,
        AdminModule,
        IngestModule,
        SecurityModule,
        HlsModule,
        StatsModule,
        ContactModule,
        FaqModule,
        WishesModule,
        ReferralModule,
        PayoutsModule,
        I18nModule,
        PrivateStreamsModule,
        BackupModule,
        OpsModule,
        CostModule,
        MarketingModule,
        AlertsModule,
        WebrtcModule,
        ModerationModule,
        PreflightModule,
        HomeModule,
        LivekitModule,
        MaintenanceModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        { provide: APP_INTERCEPTOR, useClass: SignedMediaInterceptor },
        { provide: APP_INTERCEPTOR, useClass: UsernameRequiredInterceptor },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(securityMiddleware).forRoutes("*");
    }
}

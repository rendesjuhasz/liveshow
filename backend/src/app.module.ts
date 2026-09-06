import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

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

@Module({
    imports: [
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
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as nodemailer from "nodemailer";
import {
  G2B_TENDER_ADAPTER,
  KAPT_TENDER_ADAPTER,
  KEPCO_TENDER_ADAPTER,
  PublicApiClient,
} from "./adapters/public-api-client";
import { G2bTenderAdapter } from "./adapters/g2b-tender.adapter";
import { KaptTenderAdapter } from "./adapters/kapt-tender.adapter";
import { KepcoTenderAdapter } from "./adapters/kepco-tender.adapter";
import { TenderClassifier } from "./domain/tender-classifier";
import { TENDER_SOURCE_ADAPTERS } from "./domain/tender-source.adapter";
import { Tender } from "./entities/tender.entity";
import { TenderMailDelivery } from "./entities/tender-mail-delivery.entity";
import { TenderMailItem } from "./entities/tender-mail-item.entity";
import { TenderDailyDispatch } from "./entities/tender-daily-dispatch.entity";
import { TenderRecipient } from "./entities/tender-recipient.entity";
import { TenderSubscription } from "./entities/tender-subscription.entity";
import { TenderSyncRun } from "./entities/tender-sync-run.entity";
import { TenderIngestionService } from "./services/tender-ingestion.service";
import { TenderSchedulerService } from "./services/tender-scheduler.service";
import { TenderQueryService } from "./services/tender-query.service";
import { TenderSubscriptionService } from "./services/tender-subscription.service";
import { TenderMailRenderer } from "./mail/tender-mail-renderer";
import { TENDER_MAIL_TRANSPORT, TenderMailService } from "./services/tender-mail.service";
import { TendersController } from "./tenders.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tender,
      TenderSubscription,
      TenderRecipient,
      TenderSyncRun,
      TenderMailDelivery,
      TenderMailItem,
      TenderDailyDispatch,
    ]),
  ],
  controllers: [TendersController],
  providers: [
    TenderClassifier,
    {
      provide: G2B_TENDER_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new G2bTenderAdapter(new PublicApiClient(), {
          baseUrl: config.get<string>("G2B_TENDER_API_BASE_URL") ?? "",
          serviceKey: config.get<string>("PUBLIC_DATA_SERVICE_KEY") ?? "",
        }),
    },
    {
      provide: KAPT_TENDER_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new KaptTenderAdapter(new PublicApiClient(), {
          baseUrl: config.get<string>("KAPT_TENDER_API_BASE_URL") ?? "",
          serviceKey: config.get<string>("PUBLIC_DATA_SERVICE_KEY") ?? "",
        }),
    },
    {
      provide: KEPCO_TENDER_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new KepcoTenderAdapter(new PublicApiClient(), {
          enabled: config.get<string>("KEPCO_TENDER_ENABLED") === "true",
          baseUrl: config.get<string>("KEPCO_TENDER_API_BASE_URL") ?? "",
          apiKey: config.get<string>("KEPCO_TENDER_API_KEY") ?? "",
        }),
    },
    {
      provide: TENDER_SOURCE_ADAPTERS,
      inject: [G2B_TENDER_ADAPTER, KAPT_TENDER_ADAPTER, KEPCO_TENDER_ADAPTER],
      useFactory: (g2b, kapt, kepco) => [g2b, kapt, kepco],
    },
    TenderIngestionService,
    TenderMailRenderer,
    {
      provide: TENDER_MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => nodemailer.createTransport({
        host: config.get<string>("SMTP_HOST") ?? "smtp.worksmobile.com",
        port: Number(config.get<string>("SMTP_PORT") ?? "465"),
        secure: (config.get<string>("SMTP_SECURE") ?? "true") !== "false",
        auth: {
          user: config.get<string>("SMTP_USER") ?? "",
          pass: config.get<string>("SMTP_APP_PASSWORD") ?? "",
        },
      }),
    },
    TenderMailService,
    TenderSchedulerService,
    TenderQueryService,
    TenderSubscriptionService,
  ],
  exports: [
    TenderIngestionService,
    TenderSchedulerService,
    TenderQueryService,
    TenderSubscriptionService,
  ],
})
export class TendersModule {}

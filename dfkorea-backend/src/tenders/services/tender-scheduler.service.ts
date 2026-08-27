import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { schedule, ScheduledTask } from "node-cron";
import { TenderIngestionService } from "./tender-ingestion.service";
import { TenderMailService } from "./tender-mail.service";
import { TenderSubscriptionService } from "./tender-subscription.service";

export const TENDER_COLLECTION_CRON = "0 0 0,12 * * *";
export const TENDER_COLLECTION_TIMEZONE = "Asia/Seoul";

@Injectable()
export class TenderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private collectionTask: ScheduledTask | undefined;
  private dailyMailTask: ScheduledTask | undefined;
  private retryTask: ScheduledTask | undefined;

  constructor(
    private readonly ingestionService: TenderIngestionService,
    private readonly mailService: TenderMailService,
    private readonly subscriptionService: TenderSubscriptionService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.collectionTask) {
      return;
    }

    this.collectionTask = schedule(
      TENDER_COLLECTION_CRON,
      async () => this.ingestionService.collectAll(new Date()),
      {
        timezone: TENDER_COLLECTION_TIMEZONE,
        noOverlap: true,
      },
    );

    this.retryTask = schedule(
      "0 * * * * *",
      async () => this.mailService.retryDue(new Date()),
      { timezone: TENDER_COLLECTION_TIMEZONE, noOverlap: true },
    );
    const subscription = await this.subscriptionService.getOrCreate();
    this.rescheduleDailyMail(subscription.deliveryTime, subscription.enabled);
  }

  rescheduleDailyMail(deliveryTime: string, enabled: boolean): void {
    this.dailyMailTask?.stop();
    this.dailyMailTask?.destroy();
    this.dailyMailTask = undefined;
    if (!enabled) return;

    const [hour, minute] = deliveryTime.split(":");
    this.dailyMailTask = schedule(
      `0 ${minute} ${hour} * * *`,
      async () => this.mailService.sendDailyDigest(new Date()),
      { timezone: TENDER_COLLECTION_TIMEZONE, noOverlap: true },
    );
  }

  onModuleDestroy(): void {
    this.collectionTask?.stop();
    this.collectionTask?.destroy();
    this.collectionTask = undefined;
    this.dailyMailTask?.stop();
    this.dailyMailTask?.destroy();
    this.dailyMailTask = undefined;
    this.retryTask?.stop();
    this.retryTask?.destroy();
    this.retryTask = undefined;
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { schedule, ScheduledTask } from "node-cron";
import { TenderIngestionService } from "./tender-ingestion.service";

export const TENDER_COLLECTION_CRON = "0 0 0,12 * * *";
export const TENDER_COLLECTION_TIMEZONE = "Asia/Seoul";

@Injectable()
export class TenderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private collectionTask: ScheduledTask | undefined;

  constructor(private readonly ingestionService: TenderIngestionService) {}

  onModuleInit(): void {
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
  }

  onModuleDestroy(): void {
    this.collectionTask?.stop();
    this.collectionTask?.destroy();
    this.collectionTask = undefined;
  }
}

import { TenderAnalysisService } from "./tender-analysis.service";
import { TenderAwardCollectorService } from "./tender-award-collector.service";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { schedule, ScheduledTask } from "node-cron";
import { TenderIngestionService } from "./tender-ingestion.service";
import { TenderMailService } from "./tender-mail.service";

export const TENDER_COLLECTION_CRON = "0 0 * * * *";
export const TENDER_COLLECTION_TIMEZONE = "Asia/Seoul";
export const TENDER_ANALYSIS_CATCH_UP_SINCE = new Date(
  "2026-08-31T15:00:00.000Z",
);
const TENDER_ANALYSIS_CATCH_UP_BATCH_SIZE = 50;

@Injectable()
export class TenderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private analysisTasks: ScheduledTask[] = [];
  private collectionTask: ScheduledTask | undefined;
  private dailyMailTask: ScheduledTask | undefined;
  private retryTask: ScheduledTask | undefined;

  constructor(
    private readonly ingestionService: TenderIngestionService,
    private readonly mailService: TenderMailService,
    private readonly analysis: TenderAnalysisService,
    private readonly awards: TenderAwardCollectorService,
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

    this.dailyMailTask = schedule(
      "0 * * * * *",
      async () => this.mailService.sendDailyDigest(new Date()),
      { timezone: TENDER_COLLECTION_TIMEZONE, noOverlap: true },
    );
    this.retryTask = schedule(
      "0 * * * * *",
      async () => this.mailService.retryDue(new Date()),
      { timezone: TENDER_COLLECTION_TIMEZONE, noOverlap: true },
    );
    const options = { timezone: TENDER_COLLECTION_TIMEZONE, noOverlap: true };
    this.analysisTasks = [
      schedule(
        "10 2 * * * *",
        async () => {
          const now = new Date();
          await this.analysis.refreshStaleAnalyses(now);
          await this.analysis.processDue(now, 5);
        },
        options,
      ),
      schedule(
        "20 * * * * *",
        async () => {
          const now = new Date();
          await this.analysis.queueMissingAnalysesSince(
            TENDER_ANALYSIS_CATCH_UP_SINCE,
            TENDER_ANALYSIS_CATCH_UP_BATCH_SIZE,
          );
          await this.analysis.processDue(now, 2);
        },
        options,
      ),
      // Award ticks share the collector's advisory lock. Leave the top of hour
      // clear for normal notices, and resume only one bounded provider page.
      schedule(
        "0 15 2 * * *",
        async () => this.awards.collectIncremental(new Date()),
        options,
      ),
      schedule(
        "30 5-50/5 * * * *",
        async () => this.awards.collectIncremental(new Date()),
        options,
      ),
    ];

    // Startup only creates durable queue rows. Document fetching and analysis
    // stay on the bounded cron workers so application readiness is not delayed.
    await this.analysis.queueMissingAnalysesSince(
      TENDER_ANALYSIS_CATCH_UP_SINCE,
      TENDER_ANALYSIS_CATCH_UP_BATCH_SIZE,
    );
  }

  onModuleDestroy(): void {
    for (const task of this.analysisTasks) {
      task.stop();
      task.destroy();
    }
    this.analysisTasks = [];
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

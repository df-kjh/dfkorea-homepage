import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenderTables1787819500000 implements MigrationInterface {
  name = 'CreateTenderTables1787819500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "tenders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar NOT NULL,
        "sourceNoticeId" varchar NOT NULL,
        "revision" varchar NOT NULL,
        "title" varchar NOT NULL,
        "orderingOrganization" varchar NOT NULL,
        "demandOrganization" varchar,
        "registeredAt" timestamptz NOT NULL,
        "bidStartedAt" timestamptz,
        "bidEndedAt" timestamptz,
        "openedAt" timestamptz,
        "region" varchar,
        "procurementType" varchar NOT NULL,
        "contractMethod" varchar,
        "estimatedAmount" bigint,
        "sourceUrl" varchar NOT NULL,
        "relevance" varchar NOT NULL,
        "relevanceScore" integer NOT NULL,
        "relevanceReasons" jsonb NOT NULL,
        "rawData" jsonb NOT NULL,
        "firstCollectedAt" timestamptz NOT NULL DEFAULT now(),
        "lastUpdatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_source_notice_revision" UNIQUE ("source", "sourceNoticeId", "revision")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_registered_at" ON "tenders" ("registeredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_source" ON "tenders" ("source")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_relevance" ON "tenders" ("relevance")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_region" ON "tenders" ("region")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_procurement_type" ON "tenders" ("procurementType")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tender_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "enabled" boolean NOT NULL DEFAULT false,
        "deliveryTime" varchar(5) NOT NULL DEFAULT '09:00',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tender_recipients" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "subscriptionId" uuid NOT NULL,
        "email" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_recipient_email" UNIQUE ("email"),
        CONSTRAINT "FK_tender_recipient_subscription" FOREIGN KEY ("subscriptionId")
          REFERENCES "tender_subscriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tender_sync_runs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar NOT NULL,
        "scheduledAt" timestamptz NOT NULL,
        "startedAt" timestamptz,
        "finishedAt" timestamptz,
        "status" varchar NOT NULL DEFAULT 'RUNNING',
        "fetchedCount" integer NOT NULL DEFAULT 0,
        "createdCount" integer NOT NULL DEFAULT 0,
        "updatedCount" integer NOT NULL DEFAULT 0,
        "excludedCount" integer NOT NULL DEFAULT 0,
        "errorCode" varchar,
        "errorMessage" text,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_sync_run_source" ON "tender_sync_runs" ("source")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_sync_run_status" ON "tender_sync_runs" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tender_mail_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "recipientEmail" varchar NOT NULL,
        "targetDate" date NOT NULL,
        "attemptCount" integer NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "nextRetryAt" timestamptz,
        "smtpMessageId" varchar,
        "sentAt" timestamptz,
        "failedAt" timestamptz,
        "errorMessage" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_mail_delivery_status_next_retry_at" ON "tender_mail_deliveries" ("status", "nextRetryAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_mail_delivery_recipient_target_date" ON "tender_mail_deliveries" ("recipientEmail", "targetDate")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tender_mail_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "recipientId" uuid NOT NULL,
        "tenderId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "lastDeliveryId" uuid,
        "sentAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_mail_item_recipient_tender" UNIQUE ("recipientId", "tenderId"),
        CONSTRAINT "FK_tender_mail_item_recipient" FOREIGN KEY ("recipientId")
          REFERENCES "tender_recipients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tender_mail_item_tender" FOREIGN KEY ("tenderId")
          REFERENCES "tenders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tender_mail_item_last_delivery" FOREIGN KEY ("lastDeliveryId")
          REFERENCES "tender_mail_deliveries"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tender_mail_items"`);
    await queryRunner.query(`DROP TABLE "tender_mail_deliveries"`);
    await queryRunner.query(`DROP TABLE "tender_sync_runs"`);
    await queryRunner.query(`DROP TABLE "tender_recipients"`);
    await queryRunner.query(`DROP TABLE "tender_subscriptions"`);
    await queryRunner.query(`DROP TABLE "tenders"`);
  }
}

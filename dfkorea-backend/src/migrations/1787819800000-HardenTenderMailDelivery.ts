import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenTenderMailDelivery1787819800000 implements MigrationInterface {
  name = "HardenTenderMailDelivery1787819800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "tender_recipients" ADD "isActive" boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tender_recipient_subscription_active" ON "tender_recipients" ("subscriptionId", "isActive")',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" ADD "uncertainAt" timestamptz',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_items" ADD "uncertainAt" timestamptz',
    );
    await queryRunner.query(`
      CREATE TABLE "tender_daily_dispatches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "businessDate" date NOT NULL,
        "deliveryTime" varchar(5) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'CLAIMED',
        "claimedAt" timestamptz NOT NULL,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_daily_dispatch_business_date" UNIQUE ("businessDate")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_tender_daily_dispatch_status" ON "tender_daily_dispatches" ("status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tender_daily_dispatches"');
    await queryRunner.query(
      'ALTER TABLE "tender_mail_items" DROP COLUMN "uncertainAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "uncertainAt"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_tender_recipient_subscription_active"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_recipients" DROP COLUMN "isActive"',
    );
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class LinkDailyDispatchDeliveries1787820100000 implements MigrationInterface {
  name = "LinkDailyDispatchDeliveries1787820100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing audit rows remain nullable. Every delivery created after this
    // migration records its dispatch/recipient identity in application code.
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" ADD "dailyDispatchId" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" ADD "recipientId" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" ADD CONSTRAINT "UQ_tender_mail_delivery_dispatch_recipient" UNIQUE ("dailyDispatchId", "recipientId")',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" ADD CONSTRAINT "FK_tender_mail_delivery_daily_dispatch" FOREIGN KEY ("dailyDispatchId") REFERENCES "tender_daily_dispatches"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" ADD CONSTRAINT "FK_tender_mail_delivery_recipient" FOREIGN KEY ("recipientId") REFERENCES "tender_recipients"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" DROP CONSTRAINT "FK_tender_mail_delivery_recipient"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" DROP CONSTRAINT "FK_tender_mail_delivery_daily_dispatch"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" DROP CONSTRAINT "UQ_tender_mail_delivery_dispatch_recipient"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "recipientId"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "dailyDispatchId"',
    );
  }
}

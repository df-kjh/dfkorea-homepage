import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenderMailDeliveryClaimedAt1787819700000 implements MigrationInterface {
  name = "AddTenderMailDeliveryClaimedAt1787819700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" ADD "claimedAt" timestamptz',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tender_mail_delivery_status_claimed_at" ON "tender_mail_deliveries" ("status", "claimedAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_tender_mail_delivery_status_claimed_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "claimedAt"',
    );
  }
}

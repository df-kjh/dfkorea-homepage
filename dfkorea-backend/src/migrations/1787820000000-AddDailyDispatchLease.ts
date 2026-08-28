import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDailyDispatchLease1787820000000 implements MigrationInterface {
  name = "AddDailyDispatchLease1787820000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "tender_daily_dispatches" ADD "leaseExpiresAt" timestamptz',
    );
    await queryRunner.query(
      'UPDATE "tender_daily_dispatches" SET "leaseExpiresAt" = "claimedAt" + interval \'15 minutes\'',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_daily_dispatches" ALTER COLUMN "leaseExpiresAt" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_daily_dispatches" ADD "lastError" text',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_tender_daily_dispatch_status"',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tender_daily_dispatch_status_lease" ON "tender_daily_dispatches" ("status", "leaseExpiresAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_tender_daily_dispatch_status_lease"',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tender_daily_dispatch_status" ON "tender_daily_dispatches" ("status")',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_daily_dispatches" DROP COLUMN "lastError"',
    );
    await queryRunner.query(
      'ALTER TABLE "tender_daily_dispatches" DROP COLUMN "leaseExpiresAt"',
    );
  }
}

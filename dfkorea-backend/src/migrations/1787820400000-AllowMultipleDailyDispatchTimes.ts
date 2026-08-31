import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowMultipleDailyDispatchTimes1787820400000
  implements MigrationInterface
{
  name = "AllowMultipleDailyDispatchTimes1787820400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("tender_daily_dispatches"))) return;

    await queryRunner.query(
      'ALTER TABLE "tender_daily_dispatches" DROP CONSTRAINT IF EXISTS "UQ_tender_daily_dispatch_business_date"',
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_tender_daily_dispatch_business_date_delivery_time'
            AND conrelid = 'tender_daily_dispatches'::regclass
        ) THEN
          ALTER TABLE "tender_daily_dispatches"
          ADD CONSTRAINT "UQ_tender_daily_dispatch_business_date_delivery_time"
          UNIQUE ("businessDate", "deliveryTime");
        END IF;
      END
      $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("tender_daily_dispatches"))) return;

    // Refuse an unsafe rollback once more than one time slot exists for a day.
    // Collapsing those rows would destroy immutable delivery audit history.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "tender_daily_dispatches"
          GROUP BY "businessDate"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot restore date-only dispatch uniqueness without deleting audit history';
        END IF;
      END
      $$
    `);
    await queryRunner.query(
      'ALTER TABLE "tender_daily_dispatches" DROP CONSTRAINT IF EXISTS "UQ_tender_daily_dispatch_business_date_delivery_time"',
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_tender_daily_dispatch_business_date'
            AND conrelid = 'tender_daily_dispatches'::regclass
        ) THEN
          ALTER TABLE "tender_daily_dispatches"
          ADD CONSTRAINT "UQ_tender_daily_dispatch_business_date"
          UNIQUE ("businessDate");
        END IF;
      END
      $$
    `);
  }
}

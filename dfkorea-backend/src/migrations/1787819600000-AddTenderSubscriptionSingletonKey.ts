import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenderSubscriptionSingletonKey1787819600000 implements MigrationInterface {
  name = "AddTenderSubscriptionSingletonKey1787819600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tender_subscriptions"
      ADD "singletonKey" varchar(16) NOT NULL DEFAULT 'shared'
    `);
    await queryRunner.query(`
      ALTER TABLE "tender_subscriptions"
      ADD CONSTRAINT "UQ_tender_subscription_singleton_key" UNIQUE ("singletonKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tender_subscriptions"
      DROP CONSTRAINT "UQ_tender_subscription_singleton_key"
    `);
    await queryRunner.query(`
      ALTER TABLE "tender_subscriptions"
      DROP COLUMN "singletonKey"
    `);
  }
}

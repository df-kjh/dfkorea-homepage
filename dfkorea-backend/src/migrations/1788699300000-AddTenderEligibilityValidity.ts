import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenderEligibilityValidity1788699300000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // Legacy snapshots have no trustworthy expiry boundary. A one-time rules-3
    // sweep recomputes it from the full profile instead of guessing from JSON.
    await runner.query(
      'ALTER TABLE "tender_analyses" ADD COLUMN "eligibilityValidUntil" timestamptz',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE "tender_analyses" DROP COLUMN "eligibilityValidUntil"',
    );
  }
}

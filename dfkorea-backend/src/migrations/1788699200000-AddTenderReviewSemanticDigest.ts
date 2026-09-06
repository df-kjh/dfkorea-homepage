import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenderReviewSemanticDigest1788699200000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // Nullable for existing rows: the version sweep reanalyzes them from source;
    // a digest must never be backfilled from already truncated citations.
    await runner.query(
      'ALTER TABLE "tender_analyses" ADD COLUMN "reviewSemanticDigest" varchar(64)',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE "tender_analyses" DROP COLUMN "reviewSemanticDigest"',
    );
  }
}

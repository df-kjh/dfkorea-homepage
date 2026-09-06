import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTenderReviewAdminIdentity1788699100000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await this.requireEmptyIdentities(runner);
    await runner.query(
      'ALTER TABLE "tender_analysis_reviews" ALTER COLUMN "reviewerAdminId" TYPE integer USING NULL::integer',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await this.requireEmptyIdentities(runner);
    await runner.query(
      'ALTER TABLE "tender_analysis_reviews" ALTER COLUMN "reviewerAdminId" TYPE uuid USING NULL::uuid',
    );
  }

  private async requireEmptyIdentities(runner: QueryRunner): Promise<void> {
    // The unreleased UUID column cannot represent the existing integer admins.
    // Never erase or invent an identity if unexpected historic reviews exist.
    await runner.query(
      'LOCK TABLE "tender_analysis_reviews" IN ACCESS EXCLUSIVE MODE',
    );
    await runner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "tender_analysis_reviews" WHERE "reviewerAdminId" IS NOT NULL) THEN
        RAISE EXCEPTION 'Tender review identities require explicit migration before changing type';
      END IF;
    END $$`);
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenderOpportunityType1788135000000
  implements MigrationInterface
{
  name = "AddTenderOpportunityType1788135000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("tenders"))) return;

    // Expand first: existing tenders and their mail/history references remain
    // untouched while the classification columns are populated in place.
    await queryRunner.query(
      'ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "opportunityType" varchar',
    );
    await queryRunner.query(
      'ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "opportunityReasons" jsonb',
    );
    await queryRunner.query(`
      UPDATE "tenders"
      SET
        "opportunityType" = CASE
          WHEN "procurementType" = 'CONSTRUCTION'
            OR ("source" = 'KAPT' AND "rawData"->>'codeClassifyType2' = '02')
            THEN 'EXCLUDED_CONSTRUCTION'
          WHEN (
            "procurementType" = 'GOODS'
            OR ("source" = 'KAPT' AND "rawData"->>'codeClassifyType2' = '04')
          ) AND (
            "title" ~* '다수[[:space:]]*공급자[[:space:]]*계약|(^|[^A-Za-z0-9_])MAS([^A-Za-z0-9_]|$)'
            OR COALESCE("contractMethod", '') ~* '다수[[:space:]]*공급자[[:space:]]*계약|(^|[^A-Za-z0-9_])MAS([^A-Za-z0-9_]|$)'
            OR "rawData"::text ~* '다수[[:space:]]*공급자[[:space:]]*계약|(^|[^A-Za-z0-9_])MAS([^A-Za-z0-9_]|$)'
          ) THEN 'MAS'
          WHEN "procurementType" = 'GOODS'
            OR ("source" = 'KAPT' AND "rawData"->>'codeClassifyType2' = '04')
            THEN 'GOODS_SUPPLY'
          ELSE 'EXCLUDED_NON_SUPPLY'
        END,
        "opportunityReasons" = CASE
          WHEN "procurementType" = 'CONSTRUCTION'
            OR ("source" = 'KAPT' AND "rawData"->>'codeClassifyType2' = '02')
            THEN '["기존 공사 업무구분"]'::jsonb
          WHEN (
            "procurementType" = 'GOODS'
            OR ("source" = 'KAPT' AND "rawData"->>'codeClassifyType2' = '04')
          ) AND (
            "title" ~* '다수[[:space:]]*공급자[[:space:]]*계약|(^|[^A-Za-z0-9_])MAS([^A-Za-z0-9_]|$)'
            OR COALESCE("contractMethod", '') ~* '다수[[:space:]]*공급자[[:space:]]*계약|(^|[^A-Za-z0-9_])MAS([^A-Za-z0-9_]|$)'
            OR "rawData"::text ~* '다수[[:space:]]*공급자[[:space:]]*계약|(^|[^A-Za-z0-9_])MAS([^A-Za-z0-9_]|$)'
          ) THEN '["기존 MAS 표현"]'::jsonb
          WHEN "procurementType" = 'GOODS'
            OR ("source" = 'KAPT' AND "rawData"->>'codeClassifyType2' = '04')
            THEN '["기존 물품 업무구분"]'::jsonb
          ELSE '["기존 물품 외 업무구분"]'::jsonb
        END
      WHERE "opportunityType" IS NULL OR "opportunityReasons" IS NULL
    `);
    await queryRunner.query(
      'ALTER TABLE "tenders" ALTER COLUMN "opportunityType" SET DEFAULT \'EXCLUDED_NON_SUPPLY\'',
    );
    await queryRunner.query(
      'ALTER TABLE "tenders" ALTER COLUMN "opportunityReasons" SET DEFAULT \'[]\'::jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE "tenders" ALTER COLUMN "opportunityType" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "tenders" ALTER COLUMN "opportunityReasons" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_tender_opportunity_type" ON "tenders" ("opportunityType")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("tenders"))) return;

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_tender_opportunity_type"');
    await queryRunner.query(
      'ALTER TABLE "tenders" DROP COLUMN IF EXISTS "opportunityReasons"',
    );
    await queryRunner.query(
      'ALTER TABLE "tenders" DROP COLUMN IF EXISTS "opportunityType"',
    );
  }
}

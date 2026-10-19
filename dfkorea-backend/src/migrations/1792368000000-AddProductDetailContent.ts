import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductDetailContent1792368000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // No default or backfill: existing products retain their registered fields
    // and use the shared detail renderer's fallback until an admin edits them.
    await runner.query(
      'ALTER TABLE "products" ADD COLUMN "detailContent" jsonb',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "products" DROP COLUMN "detailContent"');
  }
}

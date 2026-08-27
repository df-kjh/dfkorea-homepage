import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeImagesToJsonb1740000000000 implements MigrationInterface {
  name = "ChangeImagesToJsonb1740000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 임시 jsonb 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "images_jsonb" jsonb NOT NULL DEFAULT '[]'
    `);

    // 2. 기존 text[] → { image, description } 객체 배열로 변환
    await queryRunner.query(`
      UPDATE "products"
      SET "images_jsonb" = (
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object('image', url, 'description', '')),
          '[]'::jsonb
        )
        FROM unnest(images) AS url
      )
    `);

    // 3. 기존 images(text[]) 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN "images"
    `);

    // 4. 임시 컬럼명을 images로 변경
    await queryRunner.query(`
      ALTER TABLE "products" RENAME COLUMN "images_jsonb" TO "images"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // jsonb → text[] 역변환
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "images_text" text[] NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      UPDATE "products"
      SET "images_text" = ARRAY(
        SELECT elem->>'image'
        FROM jsonb_array_elements(images) AS elem
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN "images"
    `);

    await queryRunner.query(`
      ALTER TABLE "products" RENAME COLUMN "images_text" TO "images"
    `);
  }
}

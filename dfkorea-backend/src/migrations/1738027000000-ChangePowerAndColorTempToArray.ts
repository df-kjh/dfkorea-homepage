import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangePowerAndColorTempToArray1738027000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 power 컬럼을 임시로 백업
    await queryRunner.query(`ALTER TABLE "products" RENAME COLUMN "power" TO "power_old"`);
    
    // 새로운 power 배열 컬럼 생성
    await queryRunner.query(`ALTER TABLE "products" ADD "power" text[] NOT NULL DEFAULT ARRAY[]::text[]`);
    
    // 기존 데이터를 배열로 변환하여 복사
    await queryRunner.query(`UPDATE "products" SET "power" = ARRAY["power_old"] WHERE "power_old" IS NOT NULL AND "power_old" != ''`);
    
    // 임시 컬럼 삭제
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "power_old"`);

    // 기존 colorTemp 컬럼을 임시로 백업
    await queryRunner.query(`ALTER TABLE "products" RENAME COLUMN "colorTemp" TO "colorTemp_old"`);
    
    // 새로운 colorTemp 배열 컬럼 생성
    await queryRunner.query(`ALTER TABLE "products" ADD "colorTemp" text[] NOT NULL DEFAULT ARRAY[]::text[]`);
    
    // 기존 데이터를 배열로 변환하여 복사
    await queryRunner.query(`UPDATE "products" SET "colorTemp" = ARRAY["colorTemp_old"] WHERE "colorTemp_old" IS NOT NULL AND "colorTemp_old" != ''`);
    
    // 임시 컬럼 삭제
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "colorTemp_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // power 롤백
    await queryRunner.query(`ALTER TABLE "products" RENAME COLUMN "power" TO "power_old"`);
    await queryRunner.query(`ALTER TABLE "products" ADD "power" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`UPDATE "products" SET "power" = "power_old"[1] WHERE array_length("power_old", 1) > 0`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "power_old"`);

    // colorTemp 롤백
    await queryRunner.query(`ALTER TABLE "products" RENAME COLUMN "colorTemp" TO "colorTemp_old"`);
    await queryRunner.query(`ALTER TABLE "products" ADD "colorTemp" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`UPDATE "products" SET "colorTemp" = "colorTemp_old"[1] WHERE array_length("colorTemp_old", 1) > 0`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "colorTemp_old"`);
  }
}

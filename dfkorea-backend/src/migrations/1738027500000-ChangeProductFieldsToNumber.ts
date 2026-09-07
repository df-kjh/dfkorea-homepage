import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeProductFieldsToNumber1738027500000 implements MigrationInterface {
  name = "ChangeProductFieldsToNumber1738027500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A database may have recorded the older InitialSchema without these fields.
    // Keep this reconciliation idempotent because historical synchronize runs may
    // already have created any subset of them.
    await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "powerFactor" character varying
        `);
    await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "luminanceEfficiency" character varying
        `);
    await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "colorRendering" character varying
        `);
    await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "options" text[] NOT NULL DEFAULT '{}'
        `);

    // power 배열을 numeric[] 타입으로 변경
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "power" DROP DEFAULT`,
    );
    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "power" TYPE numeric[] 
            USING "power"::numeric[]
        `);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "power" SET DEFAULT '{}'::numeric[]`,
    );

    // lifespan을 numeric 타입으로 변경
    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "lifespan" TYPE numeric 
            USING lifespan::numeric
        `);

    // colorTemp 배열을 numeric[] 타입으로 변경
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "colorTemp" DROP DEFAULT`,
    );
    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "colorTemp" TYPE numeric[] 
            USING "colorTemp"::numeric[]
        `);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "colorTemp" SET DEFAULT '{}'::numeric[]`,
    );

    // luminanceEfficiency를 numeric 타입으로 변경
    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "luminanceEfficiency" TYPE numeric 
            USING NULLIF("luminanceEfficiency"::text, '')::numeric
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Optional Product columns belong to the baseline and may contain data from a
    // historical synchronize run, so rollback reverses only this migration's types.
    // 롤백: numeric을 text로 변경
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "power" DROP DEFAULT`,
    );
    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "power" TYPE text[] 
            USING "power"::text[]
        `);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "power" SET DEFAULT ARRAY[]::text[]`,
    );

    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "lifespan" TYPE character varying 
            USING lifespan::character varying
        `);

    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "colorTemp" DROP DEFAULT`,
    );
    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "colorTemp" TYPE text[] 
            USING "colorTemp"::text[]
        `);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "colorTemp" SET DEFAULT ARRAY[]::text[]`,
    );

    await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "luminanceEfficiency" TYPE character varying 
            USING "luminanceEfficiency"::character varying
        `);
  }
}

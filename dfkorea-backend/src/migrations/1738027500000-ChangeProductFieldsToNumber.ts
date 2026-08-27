import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeProductFieldsToNumber1738027500000 implements MigrationInterface {
    name = 'ChangeProductFieldsToNumber1738027500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // power 배열을 numeric[] 타입으로 변경
        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "power" TYPE numeric[] 
            USING ARRAY(SELECT unnest(power)::numeric)
        `);

        // lifespan을 numeric 타입으로 변경
        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "lifespan" TYPE numeric 
            USING lifespan::numeric
        `);

        // colorTemp 배열을 numeric[] 타입으로 변경
        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "colorTemp" TYPE numeric[] 
            USING ARRAY(SELECT unnest("colorTemp")::numeric)
        `);

        // luminanceEfficiency를 numeric 타입으로 변경
        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "luminanceEfficiency" TYPE numeric 
            USING 
                CASE 
                    WHEN "luminanceEfficiency" IS NULL THEN NULL
                    WHEN "luminanceEfficiency" = '' THEN NULL
                    ELSE "luminanceEfficiency"::numeric
                END
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: numeric을 text로 변경
        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "power" TYPE text[] 
            USING ARRAY(SELECT unnest(power)::text)
        `);

        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "lifespan" TYPE character varying 
            USING lifespan::character varying
        `);

        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "colorTemp" TYPE text[] 
            USING ARRAY(SELECT unnest("colorTemp")::text)
        `);

        await queryRunner.query(`
            ALTER TABLE "products" 
            ALTER COLUMN "luminanceEfficiency" TYPE character varying 
            USING luminanceEfficiency::character varying
        `);
    }
}

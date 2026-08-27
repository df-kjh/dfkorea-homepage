import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCertificatesTable1771481900000 implements MigrationInterface {
  name = 'CreateCertificatesTable1771481900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create certificates table
    await queryRunner.query(`
      CREATE TABLE "certificates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "issuingOrganization" varchar NOT NULL,
        "markImage" varchar,
        "certificateImage" varchar,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "certificates"`);
  }
}

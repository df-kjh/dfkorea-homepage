import { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizeCertificateSchema } from './support/normalize-certificate-schema';

export class CreateCertificatesTable1771481900000 implements MigrationInterface {
  name = 'CreateCertificatesTable1771481900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('certificates')) {
      await normalizeCertificateSchema(queryRunner);
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "certificates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "issuingOrganization" varchar NOT NULL,
        "category" varchar,
        "markImage" varchar,
        "certificatePdf" varchar,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration also baselines databases whose table predates the
    // migration ledger. Dropping it on rollback could destroy such data, so
    // rollback is intentionally non-destructive.
    void queryRunner;
  }
}

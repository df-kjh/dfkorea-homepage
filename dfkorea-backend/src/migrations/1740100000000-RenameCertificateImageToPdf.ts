import { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizeCertificateSchema } from './support/normalize-certificate-schema';

export class RenameCertificateImageToPdf1740100000000 implements MigrationInterface {
  name = 'RenameCertificateImageToPdf1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await normalizeCertificateSchema(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration may only baseline a pre-existing canonical table. A
    // rollback cannot know whether this execution renamed anything, so
    // reverting the column would make the current entity incompatible and
    // could overwrite schema ownership outside the migration ledger.
    void queryRunner;
  }
}

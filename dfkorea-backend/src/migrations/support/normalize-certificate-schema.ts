import { QueryRunner } from 'typeorm';

export async function normalizeCertificateSchema(
  queryRunner: QueryRunner,
): Promise<void> {
  if (!(await queryRunner.hasTable('certificates'))) {
    return;
  }

  if (!(await queryRunner.hasColumn('certificates', 'category'))) {
    await queryRunner.query(
      'ALTER TABLE "certificates" ADD COLUMN "category" varchar',
    );
  }

  const hasLegacyPdfColumn = await queryRunner.hasColumn(
    'certificates',
    'certificateImage',
  );
  const hasCanonicalPdfColumn = await queryRunner.hasColumn(
    'certificates',
    'certificatePdf',
  );

  if (hasLegacyPdfColumn && hasCanonicalPdfColumn) {
    // Prefer the canonical value, but preserve legacy data when it is the only
    // value before removing the obsolete column.
    await queryRunner.query(`
      UPDATE "certificates"
      SET "certificatePdf" = COALESCE("certificatePdf", "certificateImage")
      WHERE "certificatePdf" IS NULL
    `);
    await queryRunner.query(
      'ALTER TABLE "certificates" DROP COLUMN "certificateImage"',
    );
  } else if (hasLegacyPdfColumn) {
    await queryRunner.query(`
      ALTER TABLE "certificates"
      RENAME COLUMN "certificateImage" TO "certificatePdf"
    `);
  } else if (!hasCanonicalPdfColumn) {
    await queryRunner.query(
      'ALTER TABLE "certificates" ADD COLUMN "certificatePdf" varchar',
    );
  }

}

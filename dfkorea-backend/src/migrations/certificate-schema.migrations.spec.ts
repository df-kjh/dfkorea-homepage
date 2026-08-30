import { RenameCertificateImageToPdf1740100000000 } from './1740100000000-RenameCertificateImageToPdf';
import { CreateCertificatesTable1771481900000 } from './1771481900000-CreateCertificatesTable';

const compactSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

const createQueryRunner = ({
  tableExists,
  columns = [],
}: {
  tableExists: boolean;
  columns?: string[];
}) => {
  const knownColumns = new Set(columns);

  return {
    hasTable: jest.fn().mockResolvedValue(tableExists),
    hasColumn: jest.fn(
      async (_tableName: string, columnName: string) =>
        tableExists && knownColumns.has(columnName),
    ),
    query: jest.fn().mockResolvedValue([]),
  };
};

describe('certificate schema migrations', () => {
  describe('RenameCertificateImageToPdf1740100000000', () => {
    it('renames the legacy column when certificatePdf does not exist', async () => {
      const runner = createQueryRunner({
        tableExists: true,
        columns: ['category', 'certificateImage'],
      });

      await new RenameCertificateImageToPdf1740100000000().up(
        runner as never,
      );

      expect(runner.query.mock.calls.map(([sql]) => compactSql(sql))).toEqual([
        'ALTER TABLE "certificates" RENAME COLUMN "certificateImage" TO "certificatePdf"',
      ]);
    });

    it('keeps canonical data and removes the legacy column when both exist', async () => {
      const runner = createQueryRunner({
        tableExists: true,
        columns: ['category', 'certificateImage', 'certificatePdf'],
      });

      await new RenameCertificateImageToPdf1740100000000().up(
        runner as never,
      );

      expect(runner.query.mock.calls.map(([sql]) => compactSql(sql))).toEqual([
        'UPDATE "certificates" SET "certificatePdf" = COALESCE("certificatePdf", "certificateImage") WHERE "certificatePdf" IS NULL',
        'ALTER TABLE "certificates" DROP COLUMN "certificateImage"',
      ]);
    });

    it('does nothing when the table already has only the canonical column', async () => {
      const runner = createQueryRunner({
        tableExists: true,
        columns: ['category', 'certificatePdf'],
      });

      await new RenameCertificateImageToPdf1740100000000().up(
        runner as never,
      );

      expect(runner.query).not.toHaveBeenCalled();
    });

    it('does nothing before a fresh certificates table is created', async () => {
      const runner = createQueryRunner({ tableExists: false });

      await new RenameCertificateImageToPdf1740100000000().up(
        runner as never,
      );

      expect(runner.query).not.toHaveBeenCalled();
    });

    it('does not regress a canonical production table during rollback', async () => {
      const runner = createQueryRunner({
        tableExists: true,
        columns: ['category', 'certificatePdf'],
      });

      await new RenameCertificateImageToPdf1740100000000().down(
        runner as never,
      );

      expect(runner.query).not.toHaveBeenCalled();
    });
  });

  describe('CreateCertificatesTable1771481900000', () => {
    it('creates a fresh table directly in the canonical schema', async () => {
      const runner = createQueryRunner({ tableExists: false });

      await new CreateCertificatesTable1771481900000().up(runner as never);

      const statements = runner.query.mock.calls.map(([sql]) =>
        compactSql(sql),
      );
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('"category" varchar');
      expect(statements[0]).toContain('"certificatePdf" varchar');
      expect(statements[0]).not.toContain('"certificateImage"');
    });

    it('adds only missing canonical nullable columns to an existing table', async () => {
      const runner = createQueryRunner({
        tableExists: true,
        columns: [
          'id',
          'name',
          'issuingOrganization',
          'markImage',
          'createdAt',
          'updatedAt',
        ],
      });

      await new CreateCertificatesTable1771481900000().up(runner as never);

      expect(runner.query.mock.calls.map(([sql]) => compactSql(sql))).toEqual([
        'ALTER TABLE "certificates" ADD COLUMN "category" varchar',
        'ALTER TABLE "certificates" ADD COLUMN "certificatePdf" varchar',
      ]);
    });

    it('does not alter an existing table that already matches the entity', async () => {
      const runner = createQueryRunner({
        tableExists: true,
        columns: ['category', 'certificatePdf'],
      });

      await new CreateCertificatesTable1771481900000().up(runner as never);

      expect(runner.query).not.toHaveBeenCalled();
    });
  });
});

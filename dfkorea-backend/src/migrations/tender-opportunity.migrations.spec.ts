import type { MigrationInterface } from "typeorm";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("AddTenderOpportunityType1788135000000", () => {
  const loadMigration = () => {
    const Migration = (
      require("./1788135000000-AddTenderOpportunityType") as {
        AddTenderOpportunityType1788135000000: new () => MigrationInterface;
      }
    ).AddTenderOpportunityType1788135000000;
    return new Migration();
  };

  it("backfills opportunity eligibility without deleting tender, mail, or history rows", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };

    await loadMigration().up(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(statements).toContain(
      'ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "opportunityType" varchar',
    );
    expect(statements).toContain(
      'ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "opportunityReasons" jsonb',
    );
    expect(statements.some((sql) => sql.includes("codeClassifyType2"))).toBe(true);
    expect(statements.some((sql) => sql.includes("다수"))).toBe(true);
    expect(statements.some((sql) => sql.includes("IDX_tender_opportunity_type"))).toBe(true);
    expect(statements.some((sql) => /\b(DELETE|TRUNCATE|DROP TABLE)\b/i.test(sql))).toBe(false);
  });

  it("keeps a historical G2B goods row excluded until recollection verifies its license limits", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };

    await loadMigration().up(runner as never);

    const backfill = compactSql(runner.query.mock.calls[2][0]);
    const g2bGoods =
      'WHEN "source" = \'G2B\' AND "procurementType" = \'GOODS\' THEN \'EXCLUDED_NON_SUPPLY\'';
    expect(backfill).toContain(g2bGoods);
    expect(backfill).toContain('기존 G2B 물품은 면허제한 재검증 필요');
    expect(backfill.indexOf(g2bGoods)).toBeLessThan(
      backfill.indexOf("THEN 'GOODS_SUPPLY'"),
    );
  });

  it("removes only the opportunity index and columns on rollback", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };

    await loadMigration().down(runner as never);

    expect(runner.query.mock.calls.map(([sql]) => compactSql(sql))).toEqual([
      'DROP INDEX IF EXISTS "IDX_tender_opportunity_type"',
      'ALTER TABLE "tenders" DROP COLUMN IF EXISTS "opportunityReasons"',
      'ALTER TABLE "tenders" DROP COLUMN IF EXISTS "opportunityType"',
    ]);
  });
});

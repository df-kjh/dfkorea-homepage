import type { MigrationInterface } from "typeorm";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("AllowMultipleDailyDispatchTimes1787820400000", () => {
  const loadMigration = () => {
    const Migration = (
      require("./1787820400000-AllowMultipleDailyDispatchTimes") as {
        AllowMultipleDailyDispatchTimes1787820400000: new () => MigrationInterface;
      }
    ).AllowMultipleDailyDispatchTimes1787820400000;
    return new Migration();
  };

  it("replaces the date-only identity with a date-and-time identity without deleting history", async () => {
    let Migration:
      | (new () => MigrationInterface)
      | undefined;
    try {
      Migration = (
        require("./1787820400000-AllowMultipleDailyDispatchTimes") as {
          AllowMultipleDailyDispatchTimes1787820400000?: new () => MigrationInterface;
        }
      ).AllowMultipleDailyDispatchTimes1787820400000;
    } catch {
      Migration = undefined;
    }
    expect(Migration).toBeDefined();

    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };
    await new Migration!().up(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(statements).toContain(
      'ALTER TABLE "tender_daily_dispatches" DROP CONSTRAINT IF EXISTS "UQ_tender_daily_dispatch_business_date"',
    );
    expect(
      statements.some((sql) =>
        sql.includes(
          'ALTER TABLE "tender_daily_dispatches" ADD CONSTRAINT "UQ_tender_daily_dispatch_business_date_delivery_time" UNIQUE ("businessDate", "deliveryTime")',
        ),
      ),
    ).toBe(true);
    expect(
      statements.some((sql) => /\b(DELETE|TRUNCATE|DROP TABLE)\b/i.test(sql)),
    ).toBe(false);
  });

  it("refuses rollback before dropping the composite constraint when dates have multiple slots", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest
        .fn()
        .mockRejectedValueOnce(
          new Error(
            "Cannot restore date-only dispatch uniqueness without deleting audit history",
          ),
        ),
    };

    await expect(loadMigration().down(runner as never)).rejects.toThrow(
      "without deleting audit history",
    );
    expect(runner.query).toHaveBeenCalledTimes(1);
    expect(compactSql(runner.query.mock.calls[0][0])).toContain(
      'GROUP BY "businessDate" HAVING COUNT(*) > 1',
    );
  });

  it("restores date-only uniqueness when rollback has no conflicting slots", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };

    await loadMigration().down(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(statements[0]).toContain(
      'GROUP BY "businessDate" HAVING COUNT(*) > 1',
    );
    expect(statements[1]).toBe(
      'ALTER TABLE "tender_daily_dispatches" DROP CONSTRAINT IF EXISTS "UQ_tender_daily_dispatch_business_date_delivery_time"',
    );
    expect(statements[2]).toContain(
      'ADD CONSTRAINT "UQ_tender_daily_dispatch_business_date" UNIQUE ("businessDate")',
    );
  });
});

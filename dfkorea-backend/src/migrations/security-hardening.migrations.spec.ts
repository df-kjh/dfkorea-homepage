import { InitialSchema1706200000000 } from "./1706200000000-InitialSchema";
import { RemoveInsecureDefaultAdmin1787819900000 } from "./1787819900000-RemoveInsecureDefaultAdmin";
import { AddDailyDispatchLease1787820000000 } from "./1787820000000-AddDailyDispatchLease";

describe("security hardening migrations", () => {
  it("creates a fresh admins table without known credentials", async () => {
    const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
    await new InitialSchema1706200000000().up({
      query: jest.fn(async (sql: string, parameters?: unknown[]) => {
        queries.push({ sql, parameters });
      }),
    } as never);

    expect(queries.some(({ sql }) => /CREATE TABLE "admins"/.test(sql))).toBe(
      true,
    );
    expect(queries.some(({ sql }) => /INSERT INTO "admins"/.test(sql))).toBe(
      false,
    );
    expect(JSON.stringify(queries)).not.toContain("admin123");
  });

  it("adds and backfills a non-null 15-minute daily dispatch lease before indexing it", async () => {
    const query = jest.fn().mockResolvedValue([]);

    await new AddDailyDispatchLease1787820000000().up({ query } as never);

    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements).toEqual([
      'ALTER TABLE "tender_daily_dispatches" ADD "leaseExpiresAt" timestamptz',
      'UPDATE "tender_daily_dispatches" SET "leaseExpiresAt" = "claimedAt" + interval \'15 minutes\'',
      'ALTER TABLE "tender_daily_dispatches" ALTER COLUMN "leaseExpiresAt" SET NOT NULL',
      'ALTER TABLE "tender_daily_dispatches" ADD "lastError" text',
      'DROP INDEX "IDX_tender_daily_dispatch_status"',
      'CREATE INDEX "IDX_tender_daily_dispatch_status_lease" ON "tender_daily_dispatches" ("status", "leaseExpiresAt")',
    ]);
  });

  it("deletes only the exact admin row whose stored hash verifies admin123", async () => {
    const insecureHash =
      "$2b$10$fNmx8zTfDTHj7Hj0zGyBv.ryJU6QCML.wi2SuUU55yLQ5JXNyZkiO";
    const otherHash =
      "$2b$10$7tAl25EZrl5.aGK9yLoEsu2xG/xDa7AYeOuRdvzIHX51naljnPhbe";
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 7, username: "admin", password: insecureHash },
        { id: 8, username: "admin", password: otherHash },
      ])
      .mockResolvedValue([]);

    await new RemoveInsecureDefaultAdmin1787819900000().up({ query } as never);

    expect(query).toHaveBeenLastCalledWith(
      'DELETE FROM "admins" WHERE "id" = $1 AND "username" = $2 AND "password" = $3',
      [7, "admin", insecureHash],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("DELETE"),
      expect.arrayContaining([8]),
    );
  });
});

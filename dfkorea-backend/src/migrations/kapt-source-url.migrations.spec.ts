import { FixKaptSourceUrls1788135100000 } from "./1788135100000-FixKaptSourceUrls";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("FixKaptSourceUrls1788135100000", () => {
  it("updates only stale KAPT detail prefixes without deleting rows", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };

    await new FixKaptSourceUrls1788135100000().up(runner as never);

    expect(runner.query).toHaveBeenCalledTimes(1);
    const [statement, parameters] = runner.query.mock.calls[0];
    const sql = compactSql(statement);
    expect(sql).toContain(`"source" = 'KAPT'`);
    expect(sql).toContain('REPLACE("sourceUrl", $1, $2)');
    expect(sql).toContain('"sourceUrl" LIKE $3');
    expect(parameters).toEqual([
      "https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=",
      "https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=",
      "https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=%",
    ]);
    expect(sql).not.toMatch(/\b(DELETE|TRUNCATE|DROP)\b/i);
  });

  it("does nothing when the tenders table is absent", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn(),
    };

    await new FixKaptSourceUrls1788135100000().up(runner as never);

    expect(runner.query).not.toHaveBeenCalled();
  });

  it("does not restore the invalid route on down", async () => {
    const runner = { query: jest.fn() };

    await new FixKaptSourceUrls1788135100000().down(runner as never);

    expect(runner.query).not.toHaveBeenCalled();
  });
});

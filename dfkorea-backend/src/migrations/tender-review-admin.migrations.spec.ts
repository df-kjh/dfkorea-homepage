import { FixTenderReviewAdminIdentity1788699100000 } from "./1788699100000-FixTenderReviewAdminIdentity";
it("corrects reviewer identity only after refusing incompatible legacy rows", async () => {
  const runner = { query: jest.fn(async (_sql: string) => []) };
  await new FixTenderReviewAdminIdentity1788699100000().up(runner as never);
  const sql = runner.query.mock.calls.map((call) => call[0]).join(" ");
  expect(sql).toContain("RAISE EXCEPTION");
  expect(sql).toContain('"reviewerAdminId" IS NOT NULL');
  expect(sql).toContain("TYPE integer");
  expect(sql.indexOf("RAISE EXCEPTION")).toBeLessThan(
    sql.indexOf("TYPE integer"),
  );
});

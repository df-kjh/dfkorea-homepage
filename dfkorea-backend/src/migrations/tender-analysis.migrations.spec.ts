import type { MigrationInterface } from "typeorm";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("CreateTenderAnalysisTables1788699000000", () => {
  const loadMigration = () => {
    const Migration = require("./1788699000000-CreateTenderAnalysisTables") as {
      CreateTenderAnalysisTables1788699000000: new () => MigrationInterface;
    };
    return new Migration.CreateTenderAnalysisTables1788699000000();
  };

  it("creates normalized analysis tables without retaining document binaries or bidder data", async () => {
    const runner = { query: jest.fn().mockResolvedValue([]) };

    await loadMigration().up(runner as never);

    const sql = runner.query.mock.calls
      .map(([statement]) => compactSql(statement))
      .join("\n");
    expect(sql).toContain('CREATE TABLE "tender_documents"');
    expect(sql).toContain('CREATE TABLE "tender_award_results"');
    expect(sql).toContain(
      'CONSTRAINT "UQ_tender_analysis_tender" UNIQUE ("tenderId")',
    );
    expect(sql).toContain(
      'CONSTRAINT "UQ_tender_document_tender_identity" UNIQUE ("tenderId", "sourceDocumentIdentity")',
    );
    expect(sql).not.toMatch(
      /bytea|binary|blob|bidderName|bidderBusinessNumber|providerPayload/i,
    );
  });

  it("creates every required recovery and price-query index", async () => {
    const runner = { query: jest.fn().mockResolvedValue([]) };

    await loadMigration().up(runner as never);

    const statements = runner.query.mock.calls.map(([statement]) =>
      compactSql(statement),
    );
    expect(statements).toEqual(
      expect.arrayContaining([
        'CREATE INDEX "IDX_tender_analysis_status_lease" ON "tender_analyses" ("status", "leaseExpiresAt")',
        'CREATE INDEX "IDX_tender_document_tender_status" ON "tender_documents" ("tenderId", "status")',
        'CREATE INDEX "IDX_tender_award_result_opened_at" ON "tender_award_results" ("openedAt")',
        'CREATE INDEX "IDX_tender_award_result_classification_method_region" ON "tender_award_results" ("productClassification", "awardMethod", "region")',
        'CREATE INDEX "IDX_tender_award_sync_run_status_lease" ON "tender_award_sync_runs" ("status", "leaseExpiresAt")',
      ]),
    );
  });

  it("rolls back only the six analysis tables in foreign-key-safe order", async () => {
    const runner = { query: jest.fn().mockResolvedValue([]) };

    await loadMigration().down(runner as never);

    expect(
      runner.query.mock.calls.map(([statement]) => compactSql(statement)),
    ).toEqual([
      'DROP TABLE IF EXISTS "tender_analysis_reviews"',
      'DROP TABLE IF EXISTS "tender_documents"',
      'DROP TABLE IF EXISTS "tender_analyses"',
      'DROP TABLE IF EXISTS "tender_award_sync_runs"',
      'DROP TABLE IF EXISTS "tender_award_results"',
      'DROP TABLE IF EXISTS "tender_company_profiles"',
    ]);
  });
});

import { UseNaverWorksMailApi1787820200000 } from "./1787820200000-UseNaverWorksMailApi";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

const createRunner = (tables: Record<string, string[]>) => ({
  hasTable: jest.fn(async (tableName: string) => tableName in tables),
  hasColumn: jest.fn(
    async (tableName: string, columnName: string) =>
      tables[tableName]?.includes(columnName) ?? false,
  ),
  query: jest.fn().mockResolvedValue([]),
});

describe("UseNaverWorksMailApi1787820200000", () => {
  it("expands the schema and preserves existing SMTP audit values", async () => {
    const runner = createRunner({
      tender_mail_deliveries: ["smtpMessageId"],
    });

    await new UseNaverWorksMailApi1787820200000().up(runner as never);

    expect(runner.query.mock.calls.map(([sql]) => compactSql(sql))).toContain(
      'ALTER TABLE "tender_mail_deliveries" ADD COLUMN "providerMessageId" varchar',
    );
    expect(runner.query.mock.calls.map(([sql]) => compactSql(sql))).toContain(
      'UPDATE "tender_mail_deliveries" SET "providerMessageId" = COALESCE("providerMessageId", "smtpMessageId") WHERE "providerMessageId" IS NULL',
    );
  });

  it("keeps both columns synchronized during a rolling deployment", async () => {
    const runner = createRunner({
      tender_mail_deliveries: ["smtpMessageId", "providerMessageId"],
    });

    await new UseNaverWorksMailApi1787820200000().up(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(statements).toContain(
      'UPDATE "tender_mail_deliveries" SET "providerMessageId" = COALESCE("providerMessageId", "smtpMessageId") WHERE "providerMessageId" IS NULL',
    );
    expect(statements.some((sql) => sql.includes("CREATE TRIGGER"))).toBe(true);
    expect(statements).not.toContain(
      'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "smtpMessageId"',
    );
  });

  it("restores the legacy column with copied values when reverted", async () => {
    const runner = createRunner({
      tender_mail_deliveries: ["providerMessageId"],
    });

    await new UseNaverWorksMailApi1787820200000().down(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(statements).toContain(
      'ALTER TABLE "tender_mail_deliveries" ADD COLUMN "smtpMessageId" varchar',
    );
    expect(statements).toContain(
      'UPDATE "tender_mail_deliveries" SET "smtpMessageId" = COALESCE("smtpMessageId", "providerMessageId") WHERE "smtpMessageId" IS NULL',
    );
    expect(statements).toContain(
      'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "providerMessageId"',
    );
  });

  it("does not alter delivery columns when only providerMessageId exists", async () => {
    const runner = createRunner({
      tender_mail_deliveries: ["providerMessageId"],
      tender_mail_oauth_credentials: [
        "id",
        "singletonKey",
        "provider",
        "accessTokenEncrypted",
        "refreshTokenEncrypted",
        "accessTokenExpiresAt",
        "scope",
        "oauthStateHash",
        "oauthStateExpiresAt",
        "connectedAt",
        "createdAt",
        "updatedAt",
      ],
    });

    await new UseNaverWorksMailApi1787820200000().up(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(
      statements.some((sql) =>
        sql.includes('ALTER TABLE "tender_mail_deliveries"'),
      ),
    ).toBe(false);
  });

  it("creates the encrypted OAuth credential table without altering existing mail data", async () => {
    const runner = createRunner({
      tender_mail_deliveries: ["providerMessageId"],
    });

    await new UseNaverWorksMailApi1787820200000().up(runner as never);

    const create = runner.query.mock.calls
      .map(([sql]) => compactSql(sql))
      .find((sql) => sql.startsWith('CREATE TABLE "tender_mail_oauth_credentials"'));
    expect(create).toContain('"refreshTokenEncrypted" text');
    expect(create).toContain(
      'CONSTRAINT "UQ_tender_mail_oauth_credential_singleton_key" UNIQUE ("singletonKey")',
    );
  });
});

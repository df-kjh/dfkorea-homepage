import { configureTestDatabase } from "./test-database";

const TEST_KEYS = [
  "TEST_DATABASE_URL",
  "TEST_DB_HOST",
  "TEST_DB_PORT",
  "TEST_DB_USERNAME",
  "TEST_DB_PASSWORD",
  "TEST_DB_NAME",
  "DB_HOST",
  "DB_PORT",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_NAME",
] as const;

describe("tender integration database guard", () => {
  let savedEnvironment: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnvironment = Object.fromEntries(
      TEST_KEYS.map((key) => [key, process.env[key]]),
    );
    for (const key of TEST_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of TEST_KEYS) {
      const value = savedEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("fails closed when no explicit test database is supplied", () => {
    expect(() => configureTestDatabase(true)).toThrow(
      "Tender integration database is required",
    );
  });

  it("rejects a production-like hostname even when the database name is test-like", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://test_user:test_password@production-db.example/dfkorea_test";

    expect(() => configureTestDatabase(true)).toThrow(
      "Refusing tender integration database",
    );
  });

  it("rejects an arbitrary remote database host that is not test/e2e named", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://test_user:test_password@postgres-db.example/dfkorea_test";

    expect(() => configureTestDatabase(true)).toThrow(
      "Refusing tender integration database",
    );
  });

  it("maps an explicit local test URL into TypeORM DB variables", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://test_user:test_password@localhost:5432/dfkorea_tender_e2e";

    configureTestDatabase(true);

    expect(process.env.DB_HOST).toBe("localhost");
    expect(process.env.DB_PORT).toBe("5432");
    expect(process.env.DB_NAME).toBe("dfkorea_tender_e2e");
  });
});

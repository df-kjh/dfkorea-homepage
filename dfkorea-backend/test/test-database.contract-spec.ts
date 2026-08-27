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

  it.each([
    "postgresql://test_user:test_password@production-test-db.example/dfkorea_e2e",
    "postgresql://test_user:test_password@test.production.example/dfkorea_e2e",
    "postgresql://test_user:test_password@live-e2e/dfkorea_e2e",
    "postgresql://test_user:test_password@localhost/dfkorea_e2e?environment=staging",
    "postgresql://test_user:test_password@localhost/dfkorea_e2e?environment=st%61ging",
  ])("rejects forbidden environment tokens in a test database URL: %s", (url) => {
    process.env.TEST_DATABASE_URL = url;

    expect(() => configureTestDatabase(true)).toThrow(
      "Refusing tender integration database",
    );
  });

  it("rejects a staging_test Docker hostname", () => {
    process.env.TEST_DB_HOST = "staging_test";
    process.env.TEST_DB_PORT = "5432";
    process.env.TEST_DB_USERNAME = "test_user";
    process.env.TEST_DB_PASSWORD = "test_password";
    process.env.TEST_DB_NAME = "dfkorea_e2e";

    expect(() => configureTestDatabase(true)).toThrow(
      "Refusing tender integration database",
    );
  });

  it("does not fall back to DB_* values when TEST_DB_* is absent", () => {
    process.env.DB_HOST = "production-db.example";
    process.env.DB_PORT = "5432";
    process.env.DB_USERNAME = "prod_user";
    process.env.DB_PASSWORD = "prod_password";
    process.env.DB_NAME = "production";

    expect(() => configureTestDatabase(true)).toThrow(
      "Tender integration database is required",
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

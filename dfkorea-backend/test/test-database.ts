const TEST_DATABASE_PATTERN = /(test|e2e)/i;

interface TestDatabaseConfiguration {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

export function configureTestDatabase(required: boolean): void {
  const configuration = readConfiguration();
  if (!configuration) {
    if (required) {
      throw new Error(
        "Tender integration database is required. Set TEST_DATABASE_URL or all TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USERNAME, TEST_DB_PASSWORD, and TEST_DB_NAME.",
      );
    }
    return;
  }

  assertSafeTestDatabase(configuration);
  process.env.DB_HOST = configuration.host;
  process.env.DB_PORT = configuration.port;
  process.env.DB_USERNAME = configuration.username;
  process.env.DB_PASSWORD = configuration.password;
  process.env.DB_NAME = configuration.database;
}

function readConfiguration(): TestDatabaseConfiguration | null {
  if (process.env.TEST_DATABASE_URL) {
    let url: URL;
    try {
      url = new URL(process.env.TEST_DATABASE_URL);
    } catch {
      throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
    }
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) {
      throw new Error("TEST_DATABASE_URL must use the postgres or postgresql protocol");
    }
    return {
      host: url.hostname,
      port: url.port || "5432",
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    };
  }

  const values = {
    host: process.env.TEST_DB_HOST,
    port: process.env.TEST_DB_PORT,
    username: process.env.TEST_DB_USERNAME,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_NAME,
  };
  const provided = Object.values(values).filter((value) => value !== undefined);
  if (provided.length === 0) return null;
  if (provided.length !== 5) {
    throw new Error(
      "Provide all TEST_DB_* values together; partial database configuration is unsafe",
    );
  }
  return values as TestDatabaseConfiguration;
}

function assertSafeTestDatabase(configuration: TestDatabaseConfiguration): void {
  if (
    !isSafeHost(configuration.host) ||
    !TEST_DATABASE_PATTERN.test(configuration.database)
  ) {
    throw new Error(
      "Refusing tender integration database: use a localhost/test/e2e host and a database name containing test or e2e",
    );
  }
}

function isSafeHost(host: string): boolean {
  // Do not accept arbitrary remote PostgreSQL-looking hostnames. `postgres`
  // is the conventional isolated docker-compose service; a remote hostname
  // must declare itself as test/e2e. The database name is checked separately.
  return (
    host === "localhost" ||
    host === "postgres" ||
    /^127\./.test(host) ||
    /^\[?::1\]?$/.test(host) ||
    /(^|[-.])(test|e2e)([-.]|$)/i.test(host)
  );
}

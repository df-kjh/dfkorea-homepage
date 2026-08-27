const TEST_DATABASE_PATTERN = /(test|e2e)/i;
const FORBIDDEN_ENVIRONMENT_PATTERN = /prod(?:uction)?|live|staging/i;
const LOCAL_TEST_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  // Explicit local Docker Compose service names. Do not broaden this list to
  // remote or environment-named hosts without a separate destructive-safety
  // design and review.
  "postgres",
  "db",
]);

interface TestDatabaseConfiguration {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  sourceUrl?: string;
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
      sourceUrl: process.env.TEST_DATABASE_URL,
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
    !LOCAL_TEST_HOSTS.has(configuration.host.toLowerCase()) ||
    !TEST_DATABASE_PATTERN.test(configuration.database) ||
    containsForbiddenEnvironmentToken(configuration)
  ) {
    throw new Error(
      "Refusing tender integration database: use only a local host (localhost, 127.0.0.1, ::1, postgres, or db) and a database name containing test or e2e without prod/live/staging tokens",
    );
  }
}

function containsForbiddenEnvironmentToken(
  configuration: TestDatabaseConfiguration,
): boolean {
  return [configuration.host, configuration.database, configuration.sourceUrl]
    .filter((value): value is string => Boolean(value))
    .some((value) => FORBIDDEN_ENVIRONMENT_PATTERN.test(decodeForSafety(value)));
}

function decodeForSafety(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed escape cannot make this target safer. Keep its literal form
    // for the token check; URL parsing has already rejected malformed URLs.
    return value;
  }
}

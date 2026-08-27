const TEST_DATABASE_PATTERN = /(test|e2e)/i;
const FORBIDDEN_ENVIRONMENT_PATTERN = /prod(?:uction)?|live|staging/i;
const MAX_SAFETY_DECODE_PASSES = 4;
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

  const safeConfiguration = assertSafeTestDatabase(configuration);
  process.env.DB_HOST = safeConfiguration.host;
  process.env.DB_PORT = safeConfiguration.port;
  process.env.DB_USERNAME = safeConfiguration.username;
  process.env.DB_PASSWORD = safeConfiguration.password;
  process.env.DB_NAME = safeConfiguration.database;
}

function readConfiguration(): TestDatabaseConfiguration | null {
  if (process.env.TEST_DATABASE_URL) {
    // Validate the raw full URL too: URL parsing alone accepts malformed
    // percent escapes in a query and would otherwise leave a safety bypass.
    decodeForSafety(process.env.TEST_DATABASE_URL);
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

function assertSafeTestDatabase(
  configuration: TestDatabaseConfiguration,
): TestDatabaseConfiguration {
  const normalized = {
    ...configuration,
    host: decodeForSafety(configuration.host),
    database: decodeForSafety(configuration.database),
    sourceUrl: configuration.sourceUrl
      ? decodeForSafety(configuration.sourceUrl)
      : undefined,
  };
  if (
    !LOCAL_TEST_HOSTS.has(normalized.host.toLowerCase()) ||
    !TEST_DATABASE_PATTERN.test(normalized.database) ||
    containsForbiddenEnvironmentToken(normalized)
  ) {
    throw new Error(
      "Refusing tender integration database: use only a local host (localhost, 127.0.0.1, ::1, postgres, or db) and a database name containing test or e2e without prod/live/staging tokens",
    );
  }
  return normalized;
}

function containsForbiddenEnvironmentToken(
  configuration: TestDatabaseConfiguration,
): boolean {
  return [configuration.host, configuration.database, configuration.sourceUrl]
    .filter((value): value is string => Boolean(value))
    .some((value) => FORBIDDEN_ENVIRONMENT_PATTERN.test(value));
}

function decodeForSafety(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < MAX_SAFETY_DECODE_PASSES; pass += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new Error(
        "Refusing tender integration database: malformed percent encoding is unsafe",
      );
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  if (decoded.includes("%")) {
    throw new Error(
      "Refusing tender integration database: residual percent encoding is unsafe",
    );
  }
  return decoded;
}

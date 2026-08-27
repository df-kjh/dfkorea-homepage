const assert = require("assert");
const { spawnSync } = require("child_process");
const {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require("fs");
const { tmpdir } = require("os");
const { join } = require("path");

const backendRoot = join(__dirname, "..");
const compiledRunner = join(
  backendRoot,
  "dist",
  "scripts",
  "run-production-process.js",
);
assert.ok(
  existsSync(compiledRunner),
  "Run npm run build before the compiled production process probe",
);

const probeRoot = mkdtempSync(join(tmpdir(), "dfkorea-compiled-wrapper-"));
const hookPath = join(probeRoot, "bootstrap-probe-hook.js");
writeFileSync(
  hookPath,
  [
    'const Module = require("module");',
    "const originalLoad = Module._load;",
    "Module._load = function(request, parent, isMain) {",
    '  if (typeof request === "string" && request.endsWith("/dist/main.js")) {',
    '    process.env.NODE_ENV = "test";',
    "    process.env.TEST_BOOTSTRAP_CONFIG_PROBE_PATH = process.env.COMPILED_PROBE_OUTPUT;",
    "  }",
    "  return originalLoad.call(this, request, parent, isMain);",
    "};",
  ].join("\n"),
  "utf8",
);

const createSandbox = (name, envFile) => {
  const sandbox = join(probeRoot, name);
  require("fs").mkdirSync(sandbox);
  symlinkSync(join(backendRoot, "dist"), join(sandbox, "dist"), "dir");
  if (envFile) {
    writeFileSync(join(sandbox, ".env.production"), envFile, "utf8");
  }
  return sandbox;
};

const completeAmbient = {
  NODE_ENV: "production",
  DB_HOST: "ambient.internal",
  DB_PORT: "5432",
  DB_USERNAME: "ambient-user",
  DB_PASSWORD: "ambient-password",
  DB_NAME: "ambient-database",
};
const fileEnvironment = [
  "NODE_ENV=production",
  "DB_HOST=file.internal",
  "DB_PORT=6543",
  "DB_USERNAME=file-user",
  "DB_PASSWORD=file-password",
  "DB_NAME=file-database",
].join("\n");

const runSuccessfulStart = (mode, sandbox, expected) => {
  const outputPath = join(sandbox, `${mode}-output.json`);
  const result = spawnSync(process.execPath, [compiledRunner, mode, "start"], {
    cwd: sandbox,
    encoding: "utf8",
    env: {
      ...process.env,
      ...completeAmbient,
      COMPILED_PROBE_OUTPUT: outputPath,
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS || ""} --require=${hookPath}`.trim(),
    },
  });

  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.strictEqual(result.stderr, "");
  assert.deepStrictEqual(
    JSON.parse(readFileSync(outputPath, "utf8")),
    expected,
  );
};

try {
  runSuccessfulStart("file", createSandbox("file", fileEnvironment), {
    host: "file.internal",
    port: 6543,
    username: "file-user",
    database: "file-database",
  });
  runSuccessfulStart("ambient", createSandbox("ambient", fileEnvironment), {
    host: "ambient.internal",
    port: 5432,
    username: "ambient-user",
    database: "ambient-database",
  });

  const createApplicationDatabaseOptions = require(
    join(backendRoot, "dist", "app.module.js"),
  ).createApplicationDatabaseOptions;
  assert.deepStrictEqual(
    {
      ...createApplicationDatabaseOptions({
        NODE_ENV: "test",
        PGHOST: "pg-only.internal",
        PGPORT: "6543",
        PGUSER: "pg-user",
        PGPASSWORD: "pg-password",
        PGDATABASE: "pg-database",
      }),
      entities: undefined,
    },
    {
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "postgres",
      database: "dfkorea",
      entities: undefined,
      synchronize: false,
      logging: true,
    },
  );
  const conflictingNonProduction = createApplicationDatabaseOptions({
    NODE_ENV: "development",
    DB_HOST: "db-wins.internal",
    DB_PORT: "6432",
    DB_USERNAME: "db-user",
    DB_PASSWORD: "db-password",
    DB_NAME: "db-database",
    PGHOST: "pg-must-not-win.internal",
    PGPORT: "6543",
    PGUSER: "pg-user",
    PGPASSWORD: "pg-password",
    PGDATABASE: "pg-database",
  });
  assert.strictEqual(conflictingNonProduction.host, "db-wins.internal");
  assert.strictEqual(conflictingNonProduction.port, 6432);
  assert.strictEqual(conflictingNonProduction.username, "db-user");
  assert.strictEqual(conflictingNonProduction.password, "db-password");
  assert.strictEqual(conflictingNonProduction.database, "db-database");

  const missingFile = spawnSync(
    process.execPath,
    [compiledRunner, "file", "start"],
    {
      cwd: createSandbox("missing-file"),
      encoding: "utf8",
      env: {
        ...process.env,
        ...completeAmbient,
        DB_PASSWORD: "missing-file-secret-must-not-print",
      },
    },
  );
  assert.strictEqual(missingFile.status, 1);
  assert.match(
    missingFile.stderr,
    /Required production environment file could not be loaded/,
  );
  assert.doesNotMatch(missingFile.stderr, /missing-file-secret-must-not-print/);

  const incompleteAmbient = spawnSync(
    process.execPath,
    [compiledRunner, "ambient", "start"],
    {
      cwd: createSandbox("missing-ambient", fileEnvironment),
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        DB_HOST: "ambient.internal",
        DB_PASSWORD: "ambient-secret-must-not-print",
      },
    },
  );
  assert.strictEqual(incompleteAmbient.status, 1);
  assert.match(
    incompleteAmbient.stderr,
    /Production environment is incomplete: DB_PORT, DB_USERNAME, DB_NAME/,
  );
  assert.doesNotMatch(
    incompleteAmbient.stderr,
    /ambient-secret-must-not-print/,
  );

  process.stdout.write(
    "compiled file/ambient Nest bootstrap, non-production DB, and fail-closed probes: PASS\n",
  );
} finally {
  rmSync(probeRoot, { recursive: true, force: true });
}

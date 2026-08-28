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
  JWT_SECRET: "Ambient-JWT-secret-with-32+Chars!2026",
};
const fileEnvironment = [
  "NODE_ENV=production",
  "DB_HOST=file.internal",
  "DB_PORT=6543",
  "DB_USERNAME=file-user",
  "DB_PASSWORD=file-password",
  "DB_NAME=file-database",
  "JWT_SECRET=File-JWT-secret-with-32+Chars!2026",
].join("\n");

const runRejectedStart = (name, environment, expectedError, secret) => {
  const result = spawnSync(
    process.execPath,
    [compiledRunner, "ambient", "start"],
    {
      cwd: createSandbox(name, fileEnvironment),
      encoding: "utf8",
      env: { PATH: process.env.PATH, ...environment },
    },
  );
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, expectedError);
  if (secret) assert.doesNotMatch(result.stderr, new RegExp(secret));
};

const runRejectedFileStart = (name, envFile, expectedError, secret) => {
  const result = spawnSync(
    process.execPath,
    [compiledRunner, "file", "start"],
    {
      cwd: createSandbox(name, envFile),
      encoding: "utf8",
      env: { PATH: process.env.PATH, ...completeAmbient },
    },
  );
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, expectedError);
  if (secret) assert.doesNotMatch(result.stderr, new RegExp(secret));
};

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

  const { createJwtModuleOptions, createJwtStrategyOptions } = require(
    join(backendRoot, "dist", "auth", "jwt-configuration.js"),
  );
  const { JwtService } = require("@nestjs/jwt");
  const jwtEnvironment = {
    NODE_ENV: "production",
    JWT_SECRET: completeAmbient.JWT_SECRET,
  };
  const token = new JwtService(createJwtModuleOptions(jwtEnvironment)).sign({
    username: "compiled-probe-admin",
  });
  assert.strictEqual(
    new JwtService({
      secret: createJwtStrategyOptions(jwtEnvironment).secretOrKey,
    }).verify(token).username,
    "compiled-probe-admin",
  );

  const fullDatabaseEnvironment = { ...completeAmbient };
  delete fullDatabaseEnvironment.JWT_SECRET;
  runRejectedStart(
    "missing-jwt",
    fullDatabaseEnvironment,
    /Production JWT_SECRET is invalid/,
  );
  runRejectedStart(
    "placeholder-jwt",
    { ...completeAmbient, JWT_SECRET: "your-secret-key-change-this" },
    /Production JWT_SECRET is invalid/,
    "your-secret-key-change-this",
  );
  runRejectedFileStart(
    "missing-file-jwt",
    fileEnvironment
      .split("\n")
      .filter((line) => !line.startsWith("JWT_SECRET="))
      .join("\n"),
    /Production JWT_SECRET is invalid/,
  );
  runRejectedFileStart(
    "placeholder-file-jwt",
    fileEnvironment.replace(
      /JWT_SECRET=.*/,
      "JWT_SECRET=your-secret-key-change-this",
    ),
    /Production JWT_SECRET is invalid/,
    "your-secret-key-change-this",
  );

  const missingAdminInput = spawnSync(
    process.execPath,
    [compiledRunner, "ambient", "admin:provision"],
    {
      cwd: createSandbox("missing-admin-input", fileEnvironment),
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        ...completeAmbient,
        DB_PASSWORD: "admin-probe-db-secret-must-not-print",
      },
    },
  );
  assert.strictEqual(missingAdminInput.status, 1);
  assert.match(missingAdminInput.stderr, /ADMIN_USERNAME/);
  assert.doesNotMatch(
    missingAdminInput.stderr,
    /admin-probe-db-secret-must-not-print/,
  );

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

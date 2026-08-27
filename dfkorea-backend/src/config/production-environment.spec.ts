import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getProductionEnvPath,
  prepareProductionEnvironment,
  validateProductionEnvironment,
} from "./production-environment";

describe("shared production environment", () => {
  const completeAmbientEnvironment: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    DB_HOST: "ambient.internal",
    DB_PORT: "5432",
    DB_USERNAME: "ambient-user",
    DB_PASSWORD: "ambient-password",
    DB_NAME: "ambient-database",
    JWT_SECRET: "ambient-jwt",
    GEMINI_API_KEY: "ambient-gemini",
  };

  it("uses file values for both compiled TypeORM and actual Nest database options", () => {
    const backendRoot = join(__dirname, "..", "..");
    const directory = mkdtempSync(join(tmpdir(), "dfkorea-shared-config-"));
    writeFileSync(
      join(directory, ".env.production"),
      [
        "NODE_ENV=production",
        "DB_HOST=file.internal",
        "DB_PORT=6543",
        "DB_USERNAME=file-user",
        'DB_PASSWORD="file#password"',
        "DB_NAME=file-database",
        "CORS_ORIGIN=https://file.example.com",
      ].join("\n"),
    );
    const probe = `
      const { prepareProductionEnvironment } = require('./src/config/production-environment');
      prepareProductionEnvironment('file', process.env.PRODUCTION_CONFIG_TEST_DIR, process.env);
      const cli = require('./src/database/typeorm.config').default.options;
      const app = require('./src/app.module').createApplicationDatabaseOptions(process.env);
      process.stdout.write(JSON.stringify({
        cli: { host: cli.host, port: cli.port, username: cli.username, password: cli.password, database: cli.database },
        app: { host: app.host, port: app.port, username: app.username, password: app.password, database: app.database },
        jwt: process.env.JWT_SECRET,
        gemini: process.env.GEMINI_API_KEY,
        cors: process.env.CORS_ORIGIN,
      }));
    `;

    try {
      const result = spawnSync(
        process.execPath,
        ["-r", "ts-node/register", "-e", probe],
        {
          cwd: backendRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            ...completeAmbientEnvironment,
            PRODUCTION_CONFIG_TEST_DIR: directory,
          },
        },
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toEqual({
        cli: {
          host: "file.internal",
          port: 6543,
          username: "file-user",
          password: "file#password",
          database: "file-database",
        },
        app: {
          host: "file.internal",
          port: 6543,
          username: "file-user",
          password: "file#password",
          database: "file-database",
        },
        jwt: "ambient-jwt",
        gemini: "ambient-gemini",
        cors: "https://file.example.com",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses ambient mode without reading a conflicting production file", () => {
    const directory = mkdtempSync(join(tmpdir(), "dfkorea-ambient-config-"));
    writeFileSync(
      join(directory, ".env.production"),
      [
        "NODE_ENV=production",
        "DB_HOST=file-must-not-win.internal",
        "DB_PORT=6543",
        "DB_USERNAME=file-user",
        "DB_PASSWORD=file-password",
        "DB_NAME=file-database",
      ].join("\n"),
    );
    const targetEnvironment = { ...completeAmbientEnvironment };

    try {
      prepareProductionEnvironment("ambient", directory, targetEnvironment);
      expect(targetEnvironment).toMatchObject(completeAmbientEnvironment);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails before connection when the exact file or a file DB value is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "dfkorea-invalid-config-"));

    try {
      expect(() =>
        prepareProductionEnvironment("file", directory, {
          ...completeAmbientEnvironment,
        }),
      ).toThrow("Required production environment file could not be loaded");

      writeFileSync(
        join(directory, ".env.production"),
        [
          "NODE_ENV=production",
          "DB_HOST=file.internal",
          "DB_PORT=5432",
          "DB_USERNAME=file-user",
          "DB_PASSWORD=file-password",
        ].join("\n"),
      );
      expect(() =>
        prepareProductionEnvironment("file", directory, {
          ...completeAmbientEnvironment,
        }),
      ).toThrow("Production environment is incomplete: DB_NAME");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails ambient mode closed and never includes secret values in errors", () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: "production",
        DB_HOST: "ambient.internal",
        DB_PASSWORD: "do-not-print-this",
      }),
    ).toThrow(
      "Production environment is incomplete: DB_PORT, DB_USERNAME, DB_NAME",
    );

    try {
      validateProductionEnvironment({
        NODE_ENV: "production",
        DB_HOST: "ambient.internal",
        DB_PASSWORD: "do-not-print-this",
      });
    } catch (error) {
      expect(String(error)).not.toContain("do-not-print-this");
    }
  });

  it("selects the exact manual file path", () => {
    expect(getProductionEnvPath("/srv/dfkorea-backend")).toBe(
      "/srv/dfkorea-backend/.env.production",
    );
  });
});

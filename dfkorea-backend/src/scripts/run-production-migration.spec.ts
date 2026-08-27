import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getProductionEnvPath,
  getTypeOrmCliArguments,
  loadProductionMigrationEnvironment,
  validateProductionMigrationEnvironment,
} from "./run-production-migration";

describe("production migration runner", () => {
  const completeEnvironment: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    DB_HOST: "database.internal",
    DB_PORT: "5432",
    DB_USERNAME: "application",
    DB_PASSWORD: "password-with-special-characters",
    DB_NAME: "dfkorea_production",
  };

  it("selects only .env.production in the current backend directory", () => {
    expect(getProductionEnvPath("/srv/dfkorea-backend")).toBe(
      "/srv/dfkorea-backend/.env.production",
    );
  });

  it("loads the explicit production file and overrides an unrelated environment", () => {
    const directory = mkdtempSync(join(tmpdir(), "dfkorea-production-env-"));
    const envPath = join(directory, ".env.production");
    writeFileSync(
      envPath,
      [
        "NODE_ENV=production",
        "DB_HOST=selected.internal",
        "DB_PORT=6543",
        "DB_USERNAME=selected-user",
        'DB_PASSWORD="selected#password"',
        "DB_NAME=selected-db",
      ].join("\n"),
    );
    const targetEnvironment: NodeJS.ProcessEnv = {
      DB_HOST: "wrong.internal",
    };

    try {
      loadProductionMigrationEnvironment(envPath, targetEnvironment);
      expect(targetEnvironment).toMatchObject({
        NODE_ENV: "production",
        DB_HOST: "selected.internal",
        DB_PORT: "6543",
        DB_USERNAME: "selected-user",
        DB_PASSWORD: "selected#password",
        DB_NAME: "selected-db",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when the exact environment file is absent", () => {
    expect(() =>
      loadProductionMigrationEnvironment(
        join(tmpdir(), "missing-dfkorea-env", ".env.production"),
        {},
      ),
    ).toThrow("Required production environment file could not be loaded");
  });

  it("does not fill variables missing from the file with ambient values", () => {
    const directory = mkdtempSync(join(tmpdir(), "dfkorea-incomplete-env-"));
    const envPath = join(directory, ".env.production");
    writeFileSync(
      envPath,
      [
        "NODE_ENV=production",
        "DB_HOST=file.internal",
        "DB_PORT=5432",
        "DB_USERNAME=file-user",
        "DB_PASSWORD=file-password",
      ].join("\n"),
    );

    try {
      expect(() =>
        loadProductionMigrationEnvironment(envPath, {
          ...completeEnvironment,
          DB_NAME: "ambient-database-must-not-win",
        }),
      ).toThrow("Production migration environment is incomplete: DB_NAME");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects missing DB variables and does not expose supplied secret values", () => {
    expect(() =>
      validateProductionMigrationEnvironment({
        NODE_ENV: "production",
        DB_HOST: "database.internal",
        DB_PASSWORD: "do-not-print-this",
      }),
    ).toThrow(
      "Production migration environment is incomplete: DB_PORT, DB_USERNAME, DB_NAME",
    );

    try {
      validateProductionMigrationEnvironment({
        NODE_ENV: "production",
        DB_HOST: "database.internal",
        DB_PASSWORD: "do-not-print-this",
      });
    } catch (error) {
      expect(String(error)).not.toContain("do-not-print-this");
    }
  });

  it("requires production mode and invokes only the compiled datasource", () => {
    expect(() =>
      validateProductionMigrationEnvironment({
        ...completeEnvironment,
        NODE_ENV: "development",
      }),
    ).toThrow("NODE_ENV must be production for an operational migration");
    expect(getTypeOrmCliArguments("run")).toEqual([
      "migration:run",
      "-d",
      "dist/database/typeorm.config.js",
    ]);
    expect(getTypeOrmCliArguments("revert")).toEqual([
      "migration:revert",
      "-d",
      "dist/database/typeorm.config.js",
    ]);
  });
});

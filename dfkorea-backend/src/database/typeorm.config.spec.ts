import {
  createTypeOrmDataSourceOptions,
  getTypeOrmPaths,
} from "./typeorm.config";
import { resolveDatabaseConnectionOptions } from "../config/production-environment";
import { createApplicationDatabaseOptions } from "../app.module";

describe("TypeORM migration discovery paths", () => {
  it.each([
    {
      runtimeExtension: ".ts" as const,
      entities: [
        "src/entities/*.entity.ts",
        "src/tenders/entities/*.entity.ts",
      ],
      migrations: ["src/migrations/*.ts"],
    },
    {
      runtimeExtension: ".js" as const,
      entities: [
        "dist/entities/*.entity.js",
        "dist/tenders/entities/*.entity.js",
      ],
      migrations: ["dist/migrations/*.js"],
    },
  ])(
    "discovers existing and tender artifacts when the runtime uses $runtimeExtension",
    ({ runtimeExtension, entities, migrations }) => {
      expect(getTypeOrmPaths(runtimeExtension)).toEqual({
        entities,
        migrations,
      });
    },
  );
});

describe("TypeORM production database configuration", () => {
  it.each(["file", "ambient"])(
    "disables query logging for the %s production path",
    () => {
      expect(
        createTypeOrmDataSourceOptions(
          {
            NODE_ENV: "production",
            DB_HOST: "production-db.internal",
            DB_PORT: "5432",
            DB_USERNAME: "application",
            DB_PASSWORD: "do-not-log-this",
            DB_NAME: "dfkorea_production",
            JWT_SECRET: "Production-JWT-secret-with-32+Chars!2026",
          },
          ".js",
        ).logging,
      ).toBe(false);
    },
  );

  it("uses only the explicit DB_* variables in production", () => {
    expect(
      resolveDatabaseConnectionOptions({
        NODE_ENV: "production",
        DB_HOST: "production-db.internal",
        DB_PORT: "6543",
        DB_USERNAME: "application",
        DB_PASSWORD: "secret-value",
        DB_NAME: "dfkorea_production",
        JWT_SECRET: "Production-JWT-secret-with-32+Chars!2026",
        PGHOST: "must-not-win",
      }),
    ).toEqual({
      host: "production-db.internal",
      port: 6543,
      username: "application",
      password: "secret-value",
      database: "dfkorea_production",
    });
  });

  it("fails closed in production instead of accepting PG fallbacks or localhost defaults", () => {
    expect(() =>
      resolveDatabaseConnectionOptions({
        NODE_ENV: "production",
        PGHOST: "fallback.internal",
        PGPORT: "5432",
        PGUSER: "fallback-user",
        PGPASSWORD: "fallback-password",
        PGDATABASE: "fallback-db",
      }),
    ).toThrow(
      "Production environment is incomplete: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME",
    );
  });

  it("retains local defaults outside production", () => {
    expect(resolveDatabaseConnectionOptions({ NODE_ENV: "test" })).toEqual({
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "postgres",
      database: "dfkorea",
    });
  });

  it("keeps actual Nest dev/test options on DB_* and ignores PG aliases", () => {
    expect(
      createApplicationDatabaseOptions({
        NODE_ENV: "test",
        PGHOST: "pg-only.internal",
        PGPORT: "6543",
        PGUSER: "pg-user",
        PGPASSWORD: "pg-password",
        PGDATABASE: "pg-database",
      }),
    ).toMatchObject({
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "postgres",
      database: "dfkorea",
    });

    expect(
      createApplicationDatabaseOptions({
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
      }),
    ).toMatchObject({
      host: "db-wins.internal",
      port: 6432,
      username: "db-user",
      password: "db-password",
      database: "db-database",
    });
  });
});

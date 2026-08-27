import {
  getTypeOrmPaths,
} from "./typeorm.config";
import { resolveDatabaseConnectionOptions } from "../config/production-environment";

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
  it("uses only the explicit DB_* variables in production", () => {
    expect(
      resolveDatabaseConnectionOptions({
        NODE_ENV: "production",
        DB_HOST: "production-db.internal",
        DB_PORT: "6543",
        DB_USERNAME: "application",
        DB_PASSWORD: "secret-value",
        DB_NAME: "dfkorea_production",
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
});

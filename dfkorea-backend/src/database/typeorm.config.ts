import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "dotenv";
import { extname } from "path";
import { resolveDatabaseConnectionOptions } from "../config/production-environment";

// Production operational commands must inject a validated environment. Loading a
// generic .env here could otherwise make a migration target the wrong database.
if (process.env.NODE_ENV !== "production") {
  config();
}

export const getTypeOrmPaths = (runtimeExtension: ".ts" | ".js") => {
  const root = runtimeExtension === ".ts" ? "src" : "dist";

  return {
    entities: [
      `${root}/entities/*.entity${runtimeExtension}`,
      `${root}/tenders/entities/*.entity${runtimeExtension}`,
    ],
    // Only timestamp-prefixed production migrations are discoverable. This
    // keeps Jest specs and support modules out of source-mode TypeORM runs.
    migrations: [`${root}/migrations/[0-9]*${runtimeExtension}`],
  };
};

export const createTypeOrmDataSourceOptions = (
  environment: NodeJS.ProcessEnv,
  runtimeExtension: ".ts" | ".js",
): DataSourceOptions => {
  const typeOrmPaths = getTypeOrmPaths(runtimeExtension);
  return {
    type: "postgres",
    ...resolveDatabaseConnectionOptions(environment),
    entities: typeOrmPaths.entities,
    migrations: typeOrmPaths.migrations,
    synchronize: false,
    // Production query/parameter logging stays off for migrations, rollback,
    // admin provisioning and application startup. It is not env-toggleable.
    logging: environment.NODE_ENV !== "production",
  };
};

const runtimeExtension = extname(__filename) === ".js" ? ".js" : ".ts";

export default new DataSource(
  createTypeOrmDataSourceOptions(process.env, runtimeExtension),
);

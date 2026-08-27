import { DataSource } from "typeorm";
import { config } from "dotenv";
import { extname } from "path";

// Production operational commands must inject a validated environment. Loading a
// generic .env here could otherwise make a migration target the wrong database.
if (process.env.NODE_ENV !== "production") {
  config();
}

const requiredProductionDatabaseVariables = [
  "DB_HOST",
  "DB_PORT",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_NAME",
] as const;

export const resolveDatabaseConnectionOptions = (
  environment: NodeJS.ProcessEnv,
) => {
  if (environment.NODE_ENV === "production") {
    const missing = requiredProductionDatabaseVariables.filter(
      (variable) => !environment[variable]?.trim(),
    );
    if (missing.length > 0) {
      throw new Error(
        `Production database configuration is incomplete: ${missing.join(", ")}`,
      );
    }

    const port = Number(environment.DB_PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(
        "Production database configuration has an invalid DB_PORT",
      );
    }

    return {
      host: environment.DB_HOST as string,
      port,
      username: environment.DB_USERNAME as string,
      password: environment.DB_PASSWORD as string,
      database: environment.DB_NAME as string,
    };
  }

  return {
    host: environment.DB_HOST || environment.PGHOST || "localhost",
    port: parseInt(environment.DB_PORT || environment.PGPORT || "5432"),
    username: environment.DB_USERNAME || environment.PGUSER || "postgres",
    password: environment.DB_PASSWORD || environment.PGPASSWORD || "postgres",
    database: environment.DB_NAME || environment.PGDATABASE || "dfkorea",
  };
};

export const getTypeOrmPaths = (runtimeExtension: ".ts" | ".js") => {
  const root = runtimeExtension === ".ts" ? "src" : "dist";

  return {
    entities: [
      `${root}/entities/*.entity${runtimeExtension}`,
      `${root}/tenders/entities/*.entity${runtimeExtension}`,
    ],
    migrations: [`${root}/migrations/*${runtimeExtension}`],
  };
};

const runtimeExtension = extname(__filename) === ".js" ? ".js" : ".ts";
const typeOrmPaths = getTypeOrmPaths(runtimeExtension);
const databaseConnectionOptions = resolveDatabaseConnectionOptions(process.env);

export default new DataSource({
  type: "postgres",
  ...databaseConnectionOptions,
  entities: typeOrmPaths.entities,
  migrations: typeOrmPaths.migrations,
  synchronize: false,
  logging: true,
});

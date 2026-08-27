import { DataSource } from "typeorm";
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

import { config } from "dotenv";
import { join } from "path";

export type ProductionEnvironmentMode = "file" | "ambient";

const requiredProductionDatabaseVariables = [
  "DB_HOST",
  "DB_PORT",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_NAME",
] as const;

export const getProductionEnvPath = (workingDirectory: string): string =>
  join(workingDirectory, ".env.production");

export const validateProductionEnvironment = (
  environment: NodeJS.ProcessEnv,
): void => {
  if (environment.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be production for a production process");
  }

  const missing = requiredProductionDatabaseVariables.filter(
    (variable) => !environment[variable]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(`Production environment is incomplete: ${missing.join(", ")}`);
  }
};

export const prepareProductionEnvironment = (
  mode: ProductionEnvironmentMode,
  workingDirectory: string,
  targetEnvironment: NodeJS.ProcessEnv,
): void => {
  if (mode === "ambient") {
    // Platform mode never reads a file; injected variables are the only authority.
    validateProductionEnvironment(targetEnvironment);
    return;
  }

  const envPath = getProductionEnvPath(workingDirectory);
  const fileEnvironment: NodeJS.ProcessEnv = {};
  const result = config({
    path: envPath,
    override: true,
    processEnv: fileEnvironment,
  });
  if (result.error) {
    throw new Error(
      `Required production environment file could not be loaded: ${envPath}`,
    );
  }

  // Required DB identity must come from this file. Ambient values may supply
  // unrelated process/app settings, while every key present in the file wins.
  validateProductionEnvironment(fileEnvironment);
  Object.assign(targetEnvironment, fileEnvironment);
};

export const resolveDatabaseConnectionOptions = (
  environment: NodeJS.ProcessEnv,
) => {
  if (environment.NODE_ENV === "production") {
    validateProductionEnvironment(environment);
    const port = Number(environment.DB_PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error("Production environment has an invalid DB_PORT");
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
    host: environment.DB_HOST || "localhost",
    port: parseInt(environment.DB_PORT || "5432"),
    username: environment.DB_USERNAME || "postgres",
    password: environment.DB_PASSWORD || "postgres",
    database: environment.DB_NAME || "dfkorea",
  };
};

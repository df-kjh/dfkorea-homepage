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

const DEVELOPMENT_JWT_SECRET =
  "dfkorea-dev-test-only-JWT-secret-never-use-in-production!";
const REJECTED_JWT_SECRETS = new Set(["your-secret-key-change-this"]);

export const JWT_SECRET_RULE =
  "JWT_SECRET must be at least 32 characters and contain at least three of lowercase, uppercase, number, and symbol";

const hasStrongJwtSecret = (value: string): boolean => {
  const characterClasses = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(
    (pattern) => pattern.test(value),
  ).length;
  return (
    value.length >= 32 &&
    characterClasses >= 3 &&
    !REJECTED_JWT_SECRETS.has(value)
  );
};

export const resolveJwtSecret = (environment: NodeJS.ProcessEnv): string => {
  const secret = environment.JWT_SECRET?.trim();
  if (environment.NODE_ENV === "production") {
    if (!secret || !hasStrongJwtSecret(secret)) {
      throw new Error(`Production JWT_SECRET is invalid. ${JWT_SECRET_RULE}`);
    }
    return secret;
  }
  return secret || DEVELOPMENT_JWT_SECRET;
};

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
  resolveJwtSecret(environment);
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

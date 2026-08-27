import { spawnSync } from "child_process";
import { config } from "dotenv";
import { join } from "path";

const requiredDatabaseVariables = [
  "DB_HOST",
  "DB_PORT",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_NAME",
] as const;

export type ProductionMigrationAction = "run" | "revert";

export const getProductionEnvPath = (workingDirectory: string): string =>
  join(workingDirectory, ".env.production");

export const validateProductionMigrationEnvironment = (
  environment: NodeJS.ProcessEnv,
): void => {
  if (environment.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be production for an operational migration");
  }

  const missing = requiredDatabaseVariables.filter(
    (variable) => !environment[variable]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Production migration environment is incomplete: ${missing.join(", ")}`,
    );
  }
};

export const loadProductionMigrationEnvironment = (
  envPath: string,
  targetEnvironment: NodeJS.ProcessEnv,
): void => {
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

  // Validate the file in isolation so ambient DB_* variables cannot silently fill
  // an incomplete operational file and select a different production database.
  validateProductionMigrationEnvironment(fileEnvironment);
  Object.assign(targetEnvironment, fileEnvironment);
};

export const getTypeOrmCliArguments = (
  action: ProductionMigrationAction,
): string[] => [`migration:${action}`, "-d", "dist/database/typeorm.config.js"];

const parseAction = (value: string | undefined): ProductionMigrationAction => {
  if (value === "run" || value === "revert") {
    return value;
  }
  throw new Error("Production migration action must be run or revert");
};

export const runProductionMigration = (
  action: ProductionMigrationAction,
  workingDirectory = process.cwd(),
): number => {
  loadProductionMigrationEnvironment(
    getProductionEnvPath(workingDirectory),
    process.env,
  );

  const typeOrmCliPath = require.resolve("typeorm/cli.js");
  const result = spawnSync(
    process.execPath,
    [typeOrmCliPath, ...getTypeOrmCliArguments(action)],
    {
      cwd: workingDirectory,
      env: process.env,
      stdio: "inherit",
    },
  );
  if (result.error) {
    throw new Error(
      `Compiled TypeORM migration could not start: ${result.error.message}`,
    );
  }
  return result.status ?? 1;
};

if (require.main === module) {
  try {
    process.exitCode = runProductionMigration(parseAction(process.argv[2]));
  } catch (error) {
    // Print only the controlled validation/process error, never environment values.
    console.error(
      error instanceof Error ? error.message : "Production migration failed",
    );
    process.exitCode = 1;
  }
}

import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { validateProductionEnvironment } from "../config/production-environment";
import dataSource from "../database/typeorm.config";
import { Admin } from "../entities/admin.entity";

const ADMIN_PROVISION_LOCK_ID = 824004;
export const ADMIN_PASSWORD_RULE =
  "ADMIN_PASSWORD must be at least 16 characters and contain lowercase, uppercase, number, and symbol";

export const validateAdminProvisioningInput = (
  environment: NodeJS.ProcessEnv,
): { username: string; password: string } => {
  const username = environment.ADMIN_USERNAME?.trim();
  const password = environment.ADMIN_PASSWORD ?? "";
  if (!username || !/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    throw new Error(
      "ADMIN_USERNAME must contain 3-64 letters, numbers, dot, underscore, or hyphen characters",
    );
  }
  if (
    password.length < 16 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(`ADMIN_PASSWORD is invalid. ${ADMIN_PASSWORD_RULE}`);
  }
  return { username, password };
};

export const getAdminProvisioningErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("ADMIN_USERNAME")) {
    return "ADMIN_USERNAME is invalid";
  }
  if (message.startsWith("ADMIN_PASSWORD")) {
    return "ADMIN_PASSWORD is invalid";
  }
  if (message.startsWith("Production environment")) return message;
  if (message === "NODE_ENV must be production for a production process") {
    return message;
  }
  if (message.startsWith("Production admin already exists")) {
    return "Production admin already exists; provisioning refused";
  }
  return "Admin provisioning failed; inspect secure database diagnostics";
};

export const assertProvisioningQueryLoggingDisabled = (
  targetDataSource: Pick<DataSource, "options">,
): void => {
  if (targetDataSource.options.logging !== false) {
    throw new Error("Production database query logging must be disabled");
  }
};

export const provisionFirstAdmin = async (
  targetDataSource: Pick<DataSource, "transaction">,
  environment: NodeJS.ProcessEnv,
): Promise<void> => {
  const input = validateAdminProvisioningInput(environment);
  await targetDataSource.transaction("SERIALIZABLE", async (manager) => {
    await manager.query("SELECT pg_advisory_xact_lock($1)", [
      ADMIN_PROVISION_LOCK_ID,
    ]);
    const repository = manager.getRepository(Admin);
    if ((await repository.count()) !== 0) {
      throw new Error("Production admin already exists; provisioning refused");
    }
    const password = await bcrypt.hash(input.password, 12);
    await repository.save(
      repository.create({ username: input.username, password }),
    );
  });
};

const run = async (): Promise<void> => {
  validateProductionEnvironment(process.env);
  validateAdminProvisioningInput(process.env);
  assertProvisioningQueryLoggingDisabled(dataSource);
  let initializedHere = false;
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      initializedHere = true;
    }
    await provisionFirstAdmin(dataSource, process.env);
    process.stdout.write("Production admin provisioned successfully\n");
  } finally {
    if (initializedHere && dataSource.isInitialized) await dataSource.destroy();
  }
};

if (require.main === module) {
  void run().catch((error: unknown) => {
    console.error(getAdminProvisioningErrorMessage(error));
    process.exitCode = 1;
  });
}

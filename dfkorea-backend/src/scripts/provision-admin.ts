import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { validateProductionEnvironment } from "../config/production-environment";
import dataSource from "../database/typeorm.config";
import { Admin } from "../entities/admin.entity";

const ADMIN_PROVISION_LOCK_ID = 824004;
const ADMIN_PASSWORD_MIN_LENGTH = 8;
export const ADMIN_PASSWORD_RULE =
  `ADMIN_PASSWORD must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters and contain at least three of lowercase, uppercase, number, and symbol`;

const countVisibleCharacters = (value: string): number =>
  Array.from(
    new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value),
  ).length;

export const validateAdminProvisioningInput = (
  environment: NodeJS.ProcessEnv,
): { username: string; password: string } => {
  const username = environment.ADMIN_USERNAME?.trim();
  const password = environment.ADMIN_PASSWORD ?? "";
  const characterClasses = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(
    (pattern) => pattern.test(password),
  ).length;
  if (!username || !/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    throw new Error(
      "ADMIN_USERNAME must contain 3-64 letters, numbers, dot, underscore, or hyphen characters",
    );
  }
  if (
    countVisibleCharacters(password) < ADMIN_PASSWORD_MIN_LENGTH ||
    characterClasses < 3
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
): Promise<"created" | "unchanged"> =>
  targetDataSource.transaction("SERIALIZABLE", async (manager) => {
    await manager.query("SELECT pg_advisory_xact_lock($1)", [
      ADMIN_PROVISION_LOCK_ID,
    ]);
    const repository = manager.getRepository(Admin);

    // 재배포 시 기존 관리자 계정과 비밀번호는 절대 변경하지 않는다.
    // Bootstrap 변수 검증도 최초 관리자가 실제로 필요한 경우에만 수행한다.
    if ((await repository.count()) !== 0) {
      return "unchanged";
    }

    const input = validateAdminProvisioningInput(environment);
    const password = await bcrypt.hash(input.password, 12);
    await repository.save(
      repository.create({ username: input.username, password }),
    );
    return "created";
  });

const run = async (): Promise<void> => {
  validateProductionEnvironment(process.env);
  assertProvisioningQueryLoggingDisabled(dataSource);
  let initializedHere = false;
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      initializedHere = true;
    }
    const result = await provisionFirstAdmin(dataSource, process.env);
    process.stdout.write(
      result === "created"
        ? "Production admin provisioned successfully\n"
        : "Production admin already exists; no changes made\n",
    );
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

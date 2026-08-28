import * as bcrypt from "bcrypt";
import {
  getAdminProvisioningErrorMessage,
  provisionFirstAdmin,
  validateAdminProvisioningInput,
} from "./provision-admin";

describe("production admin provisioning", () => {
  const validEnvironment: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    ADMIN_USERNAME: "operations-admin",
    ADMIN_PASSWORD: "Strong-First-Admin!2026",
  };

  it.each([undefined, "admin123", "alllowercasebutveryverylong"])(
    "rejects weak or missing passwords without exposing them",
    (password) => {
      expect(() =>
        validateAdminProvisioningInput({
          ...validEnvironment,
          ADMIN_PASSWORD: password,
        }),
      ).toThrow(/ADMIN_PASSWORD/);
      try {
        validateAdminProvisioningInput({
          ...validEnvironment,
          ADMIN_PASSWORD: password,
        });
      } catch (error) {
        if (password) expect(String(error)).not.toContain(password);
      }
    },
  );

  it("serializes first-admin creation and stores only a bcrypt hash", async () => {
    const repository = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 1, ...value })),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest.fn(() => repository),
    };
    const dataSource = {
      transaction: jest.fn(async (_level, callback) => callback(manager)),
    };

    await provisionFirstAdmin(dataSource as never, validEnvironment);

    expect(manager.query).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock($1)",
      [824004],
    );
    expect(dataSource.transaction).toHaveBeenCalledWith(
      "SERIALIZABLE",
      expect.any(Function),
    );
    const stored = repository.save.mock.calls[0][0];
    expect(stored.username).toBe("operations-admin");
    expect(stored.password).not.toBe(validEnvironment.ADMIN_PASSWORD);
    await expect(
      bcrypt.compare(validEnvironment.ADMIN_PASSWORD!, stored.password),
    ).resolves.toBe(true);
  });

  it("refuses to create another admin after the serialized count check", async () => {
    const repository = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(async (_level, callback) =>
        callback({
          query: jest.fn(),
          getRepository: jest.fn(() => repository),
        }),
      ),
    };

    await expect(
      provisionFirstAdmin(dataSource as never, validEnvironment),
    ).rejects.toThrow("Production admin already exists");
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("keeps validation actionable but redacts unexpected database diagnostics", () => {
    expect(
      getAdminProvisioningErrorMessage(
        new Error("ADMIN_PASSWORD is invalid. password-not-for-logs"),
      ),
    ).toBe("ADMIN_PASSWORD is invalid");
    expect(
      getAdminProvisioningErrorMessage(
        new Error("connection failed password=database-secret"),
      ),
    ).toBe("Admin provisioning failed; inspect secure database diagnostics");
  });
});

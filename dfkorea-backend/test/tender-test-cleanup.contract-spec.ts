import { DataSource } from "typeorm";
import {
  clearTenderIntegrationTables,
  closeTenderIntegrationResources,
  TENDER_INTEGRATION_TABLES,
} from "./tender-test-cleanup";

describe("tender integration test cleanup", () => {
  it("truncates only the explicit dependent-to-parent tender table order in a transaction", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const transaction = jest.fn(async (work) => work({ query }));

    await clearTenderIntegrationTables({ transaction } as unknown as DataSource);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      `TRUNCATE TABLE ${TENDER_INTEGRATION_TABLES.join(", ")} RESTART IDENTITY`,
    );
  });

  it("closes the app even when table cleanup fails, then reports the cleanup error", async () => {
    const cleanupError = new Error("cleanup unavailable");
    const transaction = jest.fn().mockRejectedValue(cleanupError);
    const destroy = jest.fn().mockResolvedValue(undefined);
    const closeApp = jest.fn().mockResolvedValue(undefined);

    await expect(
      closeTenderIntegrationResources(
        { transaction, isInitialized: true, destroy } as unknown as DataSource,
        closeApp,
      ),
    ).rejects.toThrow("cleanup unavailable");

    expect(closeApp).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

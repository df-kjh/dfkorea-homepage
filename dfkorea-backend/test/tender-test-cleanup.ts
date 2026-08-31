import { DataSource } from "typeorm";

// This deliberate child-to-parent order is the complete destructive scope of
// the disposable integration suite. Never add application or migration tables.
export const TENDER_INTEGRATION_TABLES = [
  '"tender_mail_oauth_credentials"',
  '"tender_daily_dispatches"',
  '"tender_mail_items"',
  '"tender_mail_deliveries"',
  '"tender_recipients"',
  '"tender_subscriptions"',
  '"tender_sync_runs"',
  '"tenders"',
] as const;

export async function clearTenderIntegrationTables(
  dataSource: Pick<DataSource, "transaction">,
): Promise<void> {
  // PostgreSQL supports transactional TRUNCATE, so a partial cleanup cannot
  // leave this isolated test DB in a mixed tender-table state.
  await dataSource.transaction(async (manager) => {
    await manager.query(
      `TRUNCATE TABLE ${TENDER_INTEGRATION_TABLES.join(", ")} RESTART IDENTITY`,
    );
  });
}

export async function closeTenderIntegrationResources(
  dataSource:
    | Pick<DataSource, "transaction" | "isInitialized" | "destroy">
    | undefined,
  closeApp: (() => Promise<void>) | undefined,
): Promise<void> {
  let cleanupError: unknown;
  try {
    if (dataSource) await clearTenderIntegrationTables(dataSource);
  } catch (error) {
    cleanupError = error;
  }

  let closeError: unknown;
  try {
    if (closeApp) await closeApp();
  } catch (error) {
    closeError = error;
  }

  try {
    // app.close() normally destroys TypeORM. Keep this explicit fallback so a
    // failed Nest close cannot leave the disposable DB connection open.
    if (dataSource?.isInitialized) await dataSource.destroy();
  } catch (error) {
    if (!closeError) closeError = error;
  }

  // Throw after closing so Jest records teardown trouble without masking the
  // primary test failure with an unclosed Nest/TypeORM handle.
  if (cleanupError) throw cleanupError;
  if (closeError) throw closeError;
}

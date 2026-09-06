import { TenderSourceError } from "../adapters/public-api-client";
const TERMINAL_PROVIDER_CODES = new Set([
  "10",
  "12",
  "20",
  "29",
  "30",
  "31",
  "32",
]);
/** Persist only bounded application-owned codes, never messages or raw provider
 * result codes. Authentication/configuration failures require explicit resume. */
export function classifyAwardFailure(error: unknown): {
  terminal: boolean;
  code: string;
} {
  if (!(error instanceof TenderSourceError))
    return { terminal: false, code: "AWARD_COLLECTION_FAILED" };
  if (error.code === "CONFIGURATION_ERROR")
    return { terminal: true, code: "TERMINAL_CONFIGURATION_ERROR" };
  if (
    error.code === "HTTP_ERROR" &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  )
    return { terminal: true, code: `TERMINAL_HTTP_${error.status}` };
  if (
    error.code === "PROVIDER_RESULT_ERROR" &&
    TERMINAL_PROVIDER_CODES.has(error.providerResultCode)
  )
    return {
      terminal: true,
      code: `TERMINAL_PROVIDER_${error.providerResultCode}`,
    };
  return { terminal: false, code: error.code };
}

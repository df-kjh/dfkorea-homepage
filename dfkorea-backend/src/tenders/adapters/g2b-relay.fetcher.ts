import { createHmac } from "node:crypto";
import { TenderSource } from "../domain/tender.enums";
import { TenderSourceError } from "./public-api-client";

export interface G2bRelayFetcherConfig {
  relayUrl: string;
  sharedSecret: string;
  now?: () => number;
}

const G2B_OPERATIONS = new Set([
  "getBidPblancListInfoThng",
  "getBidPblancListInfoThngBsisAmount",
  "getBidPblancListInfoLicenseLimit",
  "getBidPblancListInfoPrtcptPsblRgn",
  "getBidPblancListInfoThngPurchsObjPrdct",
]);
const ENRICHMENT_OPERATIONS_WITHOUT_REVISION = new Set([
  "getBidPblancListInfoThng",
  "getBidPblancListInfoThngBsisAmount",
]);
const ENRICHMENT_OPERATIONS_WITH_REVISION = new Set([
  "getBidPblancListInfoLicenseLimit",
  "getBidPblancListInfoPrtcptPsblRgn",
  "getBidPblancListInfoThngPurchsObjPrdct",
]);

const LIST_QUERY_FIELDS = [
  "type",
  "inqryDiv",
  "inqryBgnDt",
  "inqryEndDt",
  "pageNo",
  "numOfRows",
] as const;
const ENRICHMENT_QUERY_FIELDS = [
  "type",
  "inqryDiv",
  "bidNtceNo",
  "pageNo",
  "numOfRows",
] as const;
const REVISION_ENRICHMENT_QUERY_FIELDS = [
  "type",
  "inqryDiv",
  "bidNtceNo",
  "bidNtceOrd",
  "pageNo",
  "numOfRows",
] as const;

const configurationError = () =>
  new TenderSourceError(TenderSource.G2B, "CONFIGURATION_ERROR");

const readSecureUrl = (value: string | URL): URL => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw configurationError();
    }
    return url;
  } catch (error) {
    if (error instanceof TenderSourceError) {
      throw error;
    }
    throw configurationError();
  }
};

const readProviderUrl = (input: string | URL | Request): URL =>
  readSecureUrl(input instanceof Request ? input.url : input);

const readRelayUrl = (value: string): URL => readSecureUrl(value);

const readOperation = (url: URL): string => {
  const operation = url.pathname.split("/").filter(Boolean).at(-1);
  if (!operation || !G2B_OPERATIONS.has(operation)) {
    throw configurationError();
  }
  return operation;
};

const readQuery = (url: URL, operation: string): Record<string, string> => {
  const inquiryDivision = url.searchParams.get("inqryDiv");
  const queryFields: readonly string[] =
    operation === "getBidPblancListInfoThng" && inquiryDivision === "1"
      ? LIST_QUERY_FIELDS
      : ENRICHMENT_OPERATIONS_WITHOUT_REVISION.has(operation) &&
          inquiryDivision === "2"
        ? ENRICHMENT_QUERY_FIELDS
        : ENRICHMENT_OPERATIONS_WITH_REVISION.has(operation) &&
            inquiryDivision === "2"
          ? REVISION_ENRICHMENT_QUERY_FIELDS
          : [];
  if (queryFields.length === 0) throw configurationError();
  const expectedKeys = new Set([...queryFields, "serviceKey"]);
  const actualKeys = [...url.searchParams.keys()];
  if (
    actualKeys.length !== expectedKeys.size ||
    actualKeys.some((field) => !expectedKeys.has(field))
  ) {
    throw configurationError();
  }
  if (url.searchParams.getAll("serviceKey").length !== 1) {
    throw configurationError();
  }
  const query: Record<string, string> = {};
  for (const field of queryFields) {
    const values = url.searchParams.getAll(field);
    if (values.length !== 1) {
      throw configurationError();
    }
    query[field] = values[0]!;
  }
  return query;
};

export function createG2bRelayFetcher(
  config: G2bRelayFetcherConfig,
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch {
  return (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const providerUrl = readProviderUrl(input);
    const relayUrl = readRelayUrl(config.relayUrl);
    if (config.sharedSecret.length < 32) {
      throw configurationError();
    }

    const operation = readOperation(providerUrl);
    const body = JSON.stringify({
      operation,
      query: readQuery(providerUrl, operation),
    });
    const timestamp = String((config.now ?? Date.now)());
    const signature = createHmac("sha256", config.sharedSecret)
      .update(timestamp)
      .update(".")
      .update(body)
      .digest("hex");

    return fetcher(relayUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dfkorea-timestamp": timestamp,
        "x-dfkorea-signature": signature,
      },
      body,
      signal:
        init?.signal ?? (input instanceof Request ? input.signal : undefined),
    });
  }) as typeof fetch;
}

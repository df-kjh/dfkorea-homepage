import { createHmac } from "node:crypto";
import { TenderSource } from "../domain/tender.enums";
import { TenderSourceError } from "./public-api-client";

export interface G2bRelayFetcherConfig {
  relayUrl: string;
  sharedSecret: string;
  now?: () => number;
}

const G2B_OPERATIONS = new Set([
  "getBidPblancListInfoCnstwk",
  "getBidPblancListInfoThng",
  "getBidPblancListInfoServc",
]);

const QUERY_FIELDS = [
  "type",
  "inqryDiv",
  "inqryBgnDt",
  "inqryEndDt",
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

const readQuery = (url: URL): Record<(typeof QUERY_FIELDS)[number], string> => {
  const query = {} as Record<(typeof QUERY_FIELDS)[number], string>;
  for (const field of QUERY_FIELDS) {
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

    const body = JSON.stringify({
      operation: readOperation(providerUrl),
      query: readQuery(providerUrl),
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
      signal: init?.signal ??
        (input instanceof Request ? input.signal : undefined),
    });
  }) as typeof fetch;
}

import { TenderSource } from "../domain/tender.enums";

export const G2B_TENDER_ADAPTER = Symbol("G2B_TENDER_ADAPTER");
export const KAPT_TENDER_ADAPTER = Symbol("KAPT_TENDER_ADAPTER");
export const KEPCO_TENDER_ADAPTER = Symbol("KEPCO_TENDER_ADAPTER");

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const SUCCESS_CODES = new Set(["00", "0", "0000", "NORMAL_SERVICE"]);

export type TenderSourceErrorCode =
  | "CONFIGURATION_ERROR"
  | "REQUEST_TIMEOUT"
  | "REQUEST_ABORTED"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "INVALID_RESPONSE"
  | "PROVIDER_RESULT_ERROR"
  | "PAGINATION_LIMIT";

/**
 * Error details intentionally exclude URLs, query strings, and provider bodies
 * because all three can expose an API key or otherwise untrusted provider data.
 */
export class TenderSourceError extends Error {
  readonly cause?: unknown;

  constructor(
    readonly source: TenderSource,
    readonly code: TenderSourceErrorCode,
    readonly status: number | null = null,
    cause?: unknown,
    readonly operation: string | null = null,
    readonly providerResultCode: string | null = null,
  ) {
    super(`${source} tender source error: ${code}`);
    this.name = "TenderSourceError";
    // Keep provider failures available for internal diagnostics without making
    // them enumerable in logs or serialised API responses.
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: cause,
      });
    }
  }
}

export interface PublicApiRequest {
  source: TenderSource;
  baseUrl: string;
  operation: string;
  query: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

export interface TenderApiClient {
  getAllPages<T extends Record<string, unknown>>(
    request: PublicApiRequest,
  ): Promise<T[]>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface PublicApiClientOptions {
  /** Timeout per provider page request. Defaults to ten seconds. */
  timeoutMs?: number;
}

export class PublicApiClient implements TenderApiClient {
  private readonly timeoutMs: number;

  constructor(
    private readonly fetcher: Fetcher = globalThis.fetch,
    options: PublicApiClientOptions = {},
  ) {
    this.timeoutMs = this.toTimeoutMs(options.timeoutMs);
  }

  async getAllPages<T extends Record<string, unknown>>(
    request: PublicApiRequest,
  ): Promise<T[]> {
    const rows: T[] = [];
    let totalCount: number | null = null;

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
      const body = await this.fetchPage(request, pageNo);
      const page = this.readPage<T>(body, request.source, request.operation);
      totalCount ??= page.totalCount;
      rows.push(...page.items);

      if (rows.length >= totalCount || page.items.length === 0) {
        return rows;
      }
    }

    throw new TenderSourceError(request.source, "PAGINATION_LIMIT", null);
  }

  private async fetchPage(
    request: PublicApiRequest,
    pageNo: number,
  ): Promise<unknown> {
    if (request.signal?.aborted) {
      throw new TenderSourceError(request.source, "REQUEST_ABORTED", null);
    }

    const url = this.createUrl(request, pageNo);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;

    try {
      const pending: Promise<unknown>[] = [];

      if (request.signal) {
        const callerAbortPromise = new Promise<never>((_resolve, reject) => {
          abortListener = () => {
            controller.abort();
            reject(
              new TenderSourceError(request.source, "REQUEST_ABORTED", null),
            );
          };
          request.signal!.addEventListener("abort", abortListener, {
            once: true,
          });
        });
        pending.push(callerAbortPromise);

        // Abort can occur between the first check above and listener
        // registration. Re-checking here closes that registration window.
        if (request.signal.aborted) {
          abortListener();
          return await callerAbortPromise;
        }
      }

      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new TenderSourceError(request.source, "REQUEST_TIMEOUT", null),
          );
        }, this.timeoutMs);
      });
      const requestPromise = this.fetchAndReadJson(
        url,
        request.source,
        controller.signal,
      );
      pending.push(timeoutPromise, requestPromise);

      return await Promise.race(pending);
    } catch (error) {
      if (error instanceof TenderSourceError) {
        throw error;
      }
      if (request.signal?.aborted) {
        throw new TenderSourceError(request.source, "REQUEST_ABORTED", null);
      }
      if (controller.signal.aborted) {
        throw new TenderSourceError(request.source, "REQUEST_TIMEOUT", null);
      }
      throw new TenderSourceError(request.source, "NETWORK_ERROR", null, error);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      if (abortListener && request.signal) {
        request.signal.removeEventListener("abort", abortListener);
      }
    }
  }

  private async fetchAndReadJson(
    url: string,
    source: TenderSource,
    signal: AbortSignal,
  ): Promise<unknown> {
    const response = await this.fetcher(url, { signal });
    if (!response.ok) {
      throw new TenderSourceError(source, "HTTP_ERROR", response.status);
    }

    try {
      return await response.json();
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      throw new TenderSourceError(source, "INVALID_RESPONSE", response.status);
    }
  }

  private createUrl(request: PublicApiRequest, pageNo: number): string {
    let url: URL;
    try {
      url = new URL(
        request.operation,
        request.baseUrl.endsWith("/") ? request.baseUrl : `${request.baseUrl}/`,
      );
    } catch {
      throw new TenderSourceError(request.source, "CONFIGURATION_ERROR", null);
    }

    for (const [key, value] of Object.entries(request.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(PAGE_SIZE));

    return url.toString();
  }

  private readPage<T extends Record<string, unknown>>(
    response: unknown,
    source: TenderSource,
    operation: string,
  ): { items: T[]; totalCount: number } {
    const root = this.asRecord(response, source);
    const envelope = this.asRecord(root.response ?? root, source);
    const header = this.asRecordOrNull(envelope.header ?? root.header) ?? {};
    const resultCode = this.readText(
      header.resultCode ?? root.resultCode ?? envelope.resultCode,
    );

    if (!resultCode || !SUCCESS_CODES.has(resultCode.toUpperCase())) {
      throw new TenderSourceError(
        source,
        "PROVIDER_RESULT_ERROR",
        200,
        undefined,
        operation,
        resultCode,
      );
    }

    const body = this.asRecord(envelope.body ?? root.body ?? envelope, source);
    const itemsValue = body.items ?? body.item ?? body.data ?? [];
    const itemsContainer = this.asRecordOrNull(itemsValue);
    const rawItems = itemsContainer?.item ?? itemsValue;
    const items = Array.isArray(rawItems)
      ? rawItems.filter((item): item is T => this.isRecord(item))
      : this.isRecord(rawItems)
        ? [rawItems as T]
        : [];
    const totalCount = this.readNumber(
      body.totalCount ?? body.total_count ?? body.total ?? items.length,
    );

    if (totalCount === null || totalCount < 0) {
      throw new TenderSourceError(source, "INVALID_RESPONSE", 200);
    }

    return { items, totalCount };
  }

  private asRecord(
    value: unknown,
    source: TenderSource,
  ): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new TenderSourceError(source, "INVALID_RESPONSE", 200);
    }
    return value;
  }

  private asRecordOrNull(value: unknown): Record<string, unknown> | null {
    return this.isRecord(value) ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private readText(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }
    const text = String(value).trim();
    return text || null;
  }

  private readNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toTimeoutMs(value: number | undefined): number {
    if (!Number.isFinite(value) || value === undefined || value <= 0) {
      return DEFAULT_REQUEST_TIMEOUT_MS;
    }
    return value;
  }
}

/** Public data APIs commonly return date strings without an offset. */
export const parseKstDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})(?:[ T]?(\d{2}):?(\d{2})?:?(\d{2})?(?:\.\d{1,3})?)?(?:[zZ]|[+-]\d{2}:?\d{2})?$/,
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const components = [year, month, day, hour, minute, second].map(Number);
  const [
    yearNumber,
    monthNumber,
    dayNumber,
    hourNumber,
    minuteNumber,
    secondNumber,
  ] = components;
  const calendarValue = new Date(
    Date.UTC(
      yearNumber,
      monthNumber - 1,
      dayNumber,
      hourNumber,
      minuteNumber,
      secondNumber,
    ),
  );
  if (
    calendarValue.getUTCFullYear() !== yearNumber ||
    calendarValue.getUTCMonth() !== monthNumber - 1 ||
    calendarValue.getUTCDate() !== dayNumber ||
    calendarValue.getUTCHours() !== hourNumber ||
    calendarValue.getUTCMinutes() !== minuteNumber ||
    calendarValue.getUTCSeconds() !== secondNumber
  ) {
    return null;
  }

  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(
    Date.UTC(
      yearNumber,
      monthNumber - 1,
      dayNumber,
      hourNumber - 9,
      minuteNumber,
      secondNumber,
    ),
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatKstDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}${value("month")}${value("day")}`;
};

export const formatKstDateTimeMinute = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}${value("month")}${value("day")}${value("hour")}${value("minute")}`;
};

export const toNullableText = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value).trim();
  return text || null;
};

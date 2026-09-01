import { TenderSource } from "../domain/tender.enums";

export const G2B_TENDER_ADAPTER = Symbol("G2B_TENDER_ADAPTER");
export const KAPT_TENDER_ADAPTER = Symbol("KAPT_TENDER_ADAPTER");
export const KEPCO_TENDER_ADAPTER = Symbol("KEPCO_TENDER_ADAPTER");

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const SUCCESS_CODES = new Set(["00", "0", "0000", "NORMAL_SERVICE"]);
const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);

export type TenderSourceErrorCode =
  | "CONFIGURATION_ERROR"
  | "REQUEST_TIMEOUT"
  | "REQUEST_ABORTED"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "INVALID_RESPONSE"
  | "PROVIDER_RESULT_ERROR"
  | "PAGINATION_LIMIT";

export type TenderResponseShape =
  | "CANONICAL_BODY_WITHOUT_CODE"
  | "GATEWAY_ERROR_SHAPE"
  | "UNKNOWN_RESPONSE_SHAPE";

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
    readonly pageNo: number | null = null,
    readonly providerResultCode: string | null = null,
    readonly attempts = 1,
    readonly responseShape: TenderResponseShape | null = null,
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

interface RequestStartPermit {
  markStarted(): void;
  releaseWithoutStart(): void;
}

export interface PublicApiClientOptions {
  /** Timeout per provider page request. Defaults to ten seconds. */
  timeoutMs?: number;
  /** Minimum delay between request starts made through this client. */
  minimumRequestIntervalMs?: number;
  /** Delays before retries. At most the first two delays are used. */
  retryDelaysMs?: readonly number[];
  /** Receives only the safe diagnostic fields declared by this interface. */
  onRetry?: (event: PublicApiRetryEvent) => void;
}

export interface PublicApiRetryEvent {
  source: TenderSource;
  operation: string;
  pageNo: number;
  errorCode: TenderSourceErrorCode;
  providerResultCode: string | null;
  httpStatus: number | null;
  attempt: number;
}

export class PublicApiClient implements TenderApiClient {
  private readonly timeoutMs: number;
  private readonly minimumRequestIntervalMs: number;
  private readonly retryDelaysMs: readonly number[];
  private readonly onRetry?: (event: PublicApiRetryEvent) => void;
  private requestStartGate = Promise.resolve();
  private lastRequestStartedAt: number | null = null;

  constructor(
    private readonly fetcher: Fetcher = globalThis.fetch,
    options: PublicApiClientOptions = {},
  ) {
    this.timeoutMs = this.toTimeoutMs(options.timeoutMs);
    this.minimumRequestIntervalMs = this.toNonNegativeMs(
      options.minimumRequestIntervalMs,
    );
    this.retryDelaysMs = (options.retryDelaysMs ?? [])
      .slice(0, 2)
      .map((delay) => this.toNonNegativeMs(delay));
    this.onRetry = options.onRetry;
  }

  async getAllPages<T extends Record<string, unknown>>(
    request: PublicApiRequest,
  ): Promise<T[]> {
    const rows: T[] = [];
    let totalCount: number | null = null;

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
      const page = await this.fetchPageWithRetry<T>(request, pageNo);
      totalCount ??= page.totalCount;
      rows.push(...page.items);

      if (rows.length >= totalCount || page.items.length === 0) {
        return rows;
      }
    }

    throw new TenderSourceError(
      request.source,
      "PAGINATION_LIMIT",
      null,
      undefined,
      request.operation,
      MAX_PAGES,
    );
  }

  private async fetchPageWithRetry<T extends Record<string, unknown>>(
    request: PublicApiRequest,
    pageNo: number,
  ): Promise<{ items: T[]; totalCount: number }> {
    const maximumAttempts = this.retryDelaysMs.length + 1;

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      if (attempt > 1) {
        await this.wait(
          this.retryDelaysMs[attempt - 2] ?? 0,
          request,
          pageNo,
          attempt,
        );
      }

      const requestStart = this.acquireRequestStart(request, pageNo, attempt);
      const requestStartPermit = requestStart ? await requestStart : null;

      try {
        const body = await this.fetchPage(
          request,
          pageNo,
          attempt,
          requestStartPermit,
        );
        return this.readPage<T>(body, request, pageNo, attempt);
      } catch (error) {
        const sourceError = this.withRequestMetadata(
          error,
          request,
          pageNo,
          attempt,
        );
        if (attempt >= maximumAttempts || !this.isRetryable(sourceError)) {
          throw sourceError;
        }

        this.onRetry?.({
          source: sourceError.source,
          operation: request.operation,
          pageNo,
          errorCode: sourceError.code,
          providerResultCode: sourceError.providerResultCode,
          httpStatus: sourceError.status,
          attempt,
        });
      } finally {
        // URL or query serialization can fail before fetcher is reached. Such
        // attempts must unblock the next waiter without recording a start.
        requestStartPermit?.releaseWithoutStart();
      }
    }

    throw new TenderSourceError(
      request.source,
      "INVALID_RESPONSE",
      null,
      undefined,
      request.operation,
      pageNo,
      null,
      maximumAttempts,
    );
  }

  private async fetchPage(
    request: PublicApiRequest,
    pageNo: number,
    attempt: number,
    requestStartPermit: RequestStartPermit | null,
  ): Promise<unknown> {
    if (request.signal?.aborted) {
      throw new TenderSourceError(
        request.source,
        "REQUEST_ABORTED",
        null,
        undefined,
        request.operation,
        pageNo,
        null,
        attempt,
      );
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
              new TenderSourceError(
                request.source,
                "REQUEST_ABORTED",
                null,
                undefined,
                request.operation,
                pageNo,
                null,
                attempt,
              ),
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
            new TenderSourceError(
              request.source,
              "REQUEST_TIMEOUT",
              null,
              undefined,
              request.operation,
              pageNo,
              null,
              attempt,
            ),
          );
        }, this.timeoutMs);
      });
      const requestPromise = this.fetchAndReadJson(
        url,
        request,
        pageNo,
        attempt,
        requestStartPermit,
        controller.signal,
      );
      pending.push(timeoutPromise, requestPromise);

      return await Promise.race(pending);
    } catch (error) {
      if (error instanceof TenderSourceError) {
        throw error;
      }
      if (request.signal?.aborted) {
        throw new TenderSourceError(
          request.source,
          "REQUEST_ABORTED",
          null,
          undefined,
          request.operation,
          pageNo,
          null,
          attempt,
        );
      }
      if (controller.signal.aborted) {
        throw new TenderSourceError(
          request.source,
          "REQUEST_TIMEOUT",
          null,
          undefined,
          request.operation,
          pageNo,
          null,
          attempt,
        );
      }
      throw new TenderSourceError(
        request.source,
        "NETWORK_ERROR",
        null,
        error,
        request.operation,
        pageNo,
        null,
        attempt,
      );
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
    request: PublicApiRequest,
    pageNo: number,
    attempt: number,
    requestStartPermit: RequestStartPermit | null,
    signal: AbortSignal,
  ): Promise<unknown> {
    let responsePromise: Promise<Response>;
    try {
      // Invoke first so synchronous work at the fetch boundary cannot make the
      // recorded start stale. Gate release only queues the next waiter, while
      // this stack records the completed invocation boundary immediately.
      responsePromise = this.fetcher(url, { signal });
      requestStartPermit?.markStarted();
    } catch (error) {
      requestStartPermit?.releaseWithoutStart();
      throw error;
    }

    const response = await responsePromise;
    if (!response.ok) {
      throw new TenderSourceError(
        request.source,
        "HTTP_ERROR",
        response.status,
        undefined,
        request.operation,
        pageNo,
        null,
        attempt,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      throw new TenderSourceError(
        request.source,
        "INVALID_RESPONSE",
        response.status,
        undefined,
        request.operation,
        pageNo,
        null,
        attempt,
      );
    }
  }

  private createUrl(request: PublicApiRequest, pageNo: number): string {
    try {
      const url = new URL(
        request.operation,
        request.baseUrl.endsWith("/") ? request.baseUrl : `${request.baseUrl}/`,
      );

      for (const [key, value] of Object.entries(request.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
      url.searchParams.set("pageNo", String(pageNo));
      url.searchParams.set("numOfRows", String(PAGE_SIZE));

      return url.toString();
    } catch {
      throw new TenderSourceError(
        request.source,
        "CONFIGURATION_ERROR",
        null,
        undefined,
        request.operation,
        pageNo,
      );
    }
  }

  private readPage<T extends Record<string, unknown>>(
    response: unknown,
    request: PublicApiRequest,
    pageNo: number,
    attempt: number,
  ): { items: T[]; totalCount: number } {
    const source = request.source;
    const root = this.asRecord(response, source);
    const canonicalResponse = this.asRecordOrNull(root.response);
    const canonicalBody = this.asRecordOrNull(canonicalResponse?.body);
    const gateway = this.asRecordOrNull(root.OpenAPI_ServiceResponse);
    const gatewayHeader = this.asRecordOrNull(gateway?.cmmMsgHeader);
    const envelope = canonicalResponse ?? root;
    const header = this.asRecordOrNull(envelope.header ?? root.header) ?? {};
    const resultCode = this.readText(
      gatewayHeader?.returnReasonCode ??
        header.resultCode ??
        root.resultCode ??
        envelope.resultCode,
    );
    const hasErrorEnvelope =
      gateway !== null ||
      this.hasErrorRecord(root) ||
      this.hasErrorRecord(envelope) ||
      (canonicalBody !== null && this.hasErrorRecord(canonicalBody));

    if (
      !resultCode &&
      this.isCanonicalBodyWithoutCode(
        canonicalResponse,
        canonicalBody,
        hasErrorEnvelope,
      )
    ) {
      const totalCount = this.readCanonicalTotalCount(canonicalBody.totalCount);
      // isCanonicalBodyWithoutCode verifies totalCount before this branch.
      return {
        items: this.readItems<T>(canonicalBody.items),
        totalCount: totalCount!,
      };
    }

    if (
      hasErrorEnvelope ||
      !resultCode ||
      !SUCCESS_CODES.has(resultCode.toUpperCase())
    ) {
      throw new TenderSourceError(
        source,
        "PROVIDER_RESULT_ERROR",
        200,
        undefined,
        request.operation,
        pageNo,
        resultCode,
        attempt,
        gateway !== null
          ? "GATEWAY_ERROR_SHAPE"
          : hasErrorEnvelope || !resultCode
            ? "UNKNOWN_RESPONSE_SHAPE"
            : null,
      );
    }

    const body = this.asRecord(envelope.body ?? root.body ?? envelope, source);
    const itemsValue = body.items ?? body.item ?? body.data ?? [];
    const items = this.readItems<T>(itemsValue);
    const totalCount = this.readNumber(
      body.totalCount ?? body.total_count ?? body.total ?? items.length,
    );

    if (totalCount === null || totalCount < 0) {
      throw new TenderSourceError(source, "INVALID_RESPONSE", 200);
    }

    return { items, totalCount };
  }

  private isCanonicalBodyWithoutCode(
    response: Record<string, unknown> | null,
    body: Record<string, unknown> | null,
    hasErrorEnvelope: boolean,
  ): body is Record<string, unknown> {
    if (
      response === null ||
      body === null ||
      hasErrorEnvelope ||
      !Object.prototype.hasOwnProperty.call(body, "items") ||
      !Object.prototype.hasOwnProperty.call(body, "totalCount")
    ) {
      return false;
    }

    const totalCount = this.readCanonicalTotalCount(body.totalCount);
    return totalCount !== null && totalCount >= 0;
  }

  private hasErrorRecord(value: Record<string, unknown>): boolean {
    return (
      this.asRecordOrNull(value.error) !== null ||
      this.asRecordOrNull(value.errors) !== null
    );
  }

  private readItems<T extends Record<string, unknown>>(
    itemsValue: unknown,
  ): T[] {
    const itemsContainer = this.asRecordOrNull(itemsValue);
    const rawItems = itemsContainer?.item ?? itemsValue;
    return Array.isArray(rawItems)
      ? rawItems.filter((item): item is T => this.isRecord(item))
      : this.isRecord(rawItems)
        ? [rawItems as T]
        : [];
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

  private readCanonicalTotalCount(value: unknown): number | null {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toTimeoutMs(value: number | undefined): number {
    if (!Number.isFinite(value) || value === undefined || value <= 0) {
      return DEFAULT_REQUEST_TIMEOUT_MS;
    }
    return value;
  }

  private toNonNegativeMs(value: number | undefined): number {
    if (!Number.isFinite(value) || value === undefined || value < 0) {
      return 0;
    }
    return value;
  }

  private acquireRequestStart(
    request: PublicApiRequest,
    pageNo: number,
    attempt: number,
  ): Promise<RequestStartPermit> | null {
    if (this.minimumRequestIntervalMs <= 0) {
      return null;
    }

    let releaseGate: () => void = () => undefined;
    const precedingRequestStart = this.requestStartGate;
    this.requestStartGate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    return this.waitForRequestStart(
      precedingRequestStart,
      releaseGate,
      request,
      pageNo,
      attempt,
    );
  }

  private async waitForRequestStart(
    precedingRequestStart: Promise<void>,
    releaseGate: () => void,
    request: PublicApiRequest,
    pageNo: number,
    attempt: number,
  ): Promise<RequestStartPermit> {
    try {
      await precedingRequestStart;

      // Re-check after every timer release. Multiple overdue timers may run in
      // the same event-loop turn, so a one-time future-slot calculation does
      // not guarantee spacing between actual request starts.
      while (this.lastRequestStartedAt !== null) {
        const elapsedMs = Date.now() - this.lastRequestStartedAt;
        const remainingMs = this.minimumRequestIntervalMs - elapsedMs;
        if (remainingMs <= 0) {
          break;
        }
        await this.wait(remainingMs, request, pageNo, attempt);
      }

      // This also closes the abort window while waiting for the preceding gate.
      await this.wait(0, request, pageNo, attempt);

      let released = false;
      const release = (started: boolean) => {
        if (released) {
          return;
        }
        released = true;
        if (started) {
          this.lastRequestStartedAt = Date.now();
        }
        releaseGate();
      };
      return {
        markStarted: () => release(true),
        releaseWithoutStart: () => release(false),
      };
    } catch (error) {
      releaseGate();
      throw error;
    }
  }

  private wait(
    delayMs: number,
    request: PublicApiRequest,
    pageNo: number,
    attempt: number,
  ): Promise<void> {
    if (request.signal?.aborted) {
      return Promise.reject(
        new TenderSourceError(
          request.source,
          "REQUEST_ABORTED",
          null,
          undefined,
          request.operation,
          pageNo,
          null,
          attempt,
        ),
      );
    }
    if (delayMs <= 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        request.signal?.removeEventListener("abort", onAbort);
        reject(
          new TenderSourceError(
            request.source,
            "REQUEST_ABORTED",
            null,
            undefined,
            request.operation,
            pageNo,
            null,
            attempt,
          ),
        );
      };

      timer = setTimeout(() => {
        request.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, delayMs);
      request.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private isRetryable(error: TenderSourceError): boolean {
    if (error.code === "PROVIDER_RESULT_ERROR") {
      return error.providerResultCode === "23";
    }
    if (error.code === "HTTP_ERROR") {
      return error.status !== null && RETRYABLE_HTTP_STATUSES.has(error.status);
    }
    return error.code === "REQUEST_TIMEOUT" || error.code === "NETWORK_ERROR";
  }

  private withRequestMetadata(
    error: unknown,
    request: PublicApiRequest,
    pageNo: number,
    attempt: number,
  ): TenderSourceError {
    if (error instanceof TenderSourceError) {
      return new TenderSourceError(
        error.source,
        error.code,
        error.status,
        error.cause,
        error.operation ?? request.operation,
        error.pageNo ?? pageNo,
        error.providerResultCode,
        attempt,
        error.responseShape,
      );
    }
    return new TenderSourceError(
      request.source,
      "NETWORK_ERROR",
      null,
      error,
      request.operation,
      pageNo,
      null,
      attempt,
    );
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

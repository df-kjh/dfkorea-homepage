import { TenderSource } from "../domain/tender.enums";

export const G2B_TENDER_ADAPTER = Symbol("G2B_TENDER_ADAPTER");
export const KAPT_TENDER_ADAPTER = Symbol("KAPT_TENDER_ADAPTER");
export const KEPCO_TENDER_ADAPTER = Symbol("KEPCO_TENDER_ADAPTER");

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const SUCCESS_CODES = new Set(["00", "0", "0000", "NORMAL_SERVICE"]);

export type TenderSourceErrorCode =
  | "CONFIGURATION_ERROR"
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
  constructor(
    readonly source: TenderSource,
    readonly code: TenderSourceErrorCode,
    readonly status: number | null = null,
  ) {
    super(`${source} tender source error: ${code}`);
    this.name = "TenderSourceError";
  }
}

export interface PublicApiRequest {
  source: TenderSource;
  baseUrl: string;
  operation: string;
  query: Record<string, string | number | undefined>;
}

export interface TenderApiClient {
  getAllPages<T extends Record<string, unknown>>(
    request: PublicApiRequest,
  ): Promise<T[]>;
}

type Fetcher = (input: string) => Promise<Response>;

export class PublicApiClient implements TenderApiClient {
  constructor(private readonly fetcher: Fetcher = globalThis.fetch) {}

  async getAllPages<T extends Record<string, unknown>>(
    request: PublicApiRequest,
  ): Promise<T[]> {
    const rows: T[] = [];
    let totalCount: number | null = null;

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
      const body = await this.fetchPage(request, pageNo);
      const page = this.readPage<T>(body, request.source);
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
    const url = this.createUrl(request, pageNo);
    let response: Response;

    try {
      response = await this.fetcher(url);
    } catch {
      throw new TenderSourceError(request.source, "NETWORK_ERROR", null);
    }

    if (!response.ok) {
      throw new TenderSourceError(
        request.source,
        "HTTP_ERROR",
        response.status,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new TenderSourceError(
        request.source,
        "INVALID_RESPONSE",
        response.status,
      );
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
  ): { items: T[]; totalCount: number } {
    const root = this.asRecord(response, source);
    const envelope = this.asRecord(root.response ?? root, source);
    const header = this.asRecordOrNull(envelope.header ?? root.header) ?? {};
    const resultCode = this.readText(
      header.resultCode ?? root.resultCode ?? envelope.resultCode,
    );

    if (!resultCode || !SUCCESS_CODES.has(resultCode.toUpperCase())) {
      throw new TenderSourceError(source, "PROVIDER_RESULT_ERROR", 200);
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
}

/** Public data APIs commonly return date strings without an offset. */
export const parseKstDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = trimmed.match(
    /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})(?:[ T]?(\d{2}):?(\d{2})?:?(\d{2})?)?$/,
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const parsed = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 9,
      Number(minute),
      Number(second),
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

export const toNullableText = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value).trim();
  return text || null;
};

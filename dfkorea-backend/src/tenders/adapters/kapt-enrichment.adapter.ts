import { NormalizedTender } from "../domain/normalized-tender";
import {
  emptyTenderEnrichment,
  TenderDocumentFormat,
  TenderDocumentReference,
  TenderEnrichment,
  TenderEnrichmentAdapter,
  TenderEnrichmentError,
} from "../domain/tender-enrichment";
import { TenderSource } from "../domain/tender.enums";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const KAPT_HOSTS = new Set(["k-apt.go.kr", "www.k-apt.go.kr"]);
const KAPT_DETAIL_HOST = "www.k-apt.go.kr";
const DETAIL_PATH = "/bid/bidDetail.do";
const ATTACHMENT_PATH = "/bid/fileDownload.do";
const MAX_PAGE_BYTES = 1024 * 1024;

const formatFromName = (name: string): TenderDocumentFormat | null => {
  const extension = /\.([a-z0-9]+)(?:$|[?#])/i.exec(name)?.[1]?.toUpperCase();
  return extension === "PDF" ||
    extension === "HWP" ||
    extension === "HWPX" ||
    extension === "DOCX" ||
    extension === "XLSX"
    ? extension
    : null;
};

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const stripTags = (value: string): string =>
  decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

export class KaptEnrichmentAdapter implements TenderEnrichmentAdapter {
  constructor(private readonly fetcher: Fetcher = globalThis.fetch) {}

  async enrich(
    tender: NormalizedTender,
    signal: AbortSignal,
  ): Promise<TenderEnrichment> {
    const detailUrl = this.validateDetailUrl(tender);
    const result = emptyTenderEnrichment();
    let response: Response;
    try {
      response = await this.fetcher(detailUrl, {
        method: "GET",
        redirect: "error",
        signal,
      });
    } catch {
      result.failures.push(this.failure("NETWORK_ERROR", null));
      return result;
    }
    if (!response.ok) {
      result.failures.push(this.failure("HTTP_ERROR", response.status));
      return result;
    }

    try {
      const html = await this.readBoundedText(response);
      result.documents = this.readDocuments(html, detailUrl, tender);
    } catch (error) {
      result.failures.push(
        this.failure(
          error instanceof TenderEnrichmentError
            ? error.code
            : "INVALID_RESPONSE",
          response.status,
        ),
      );
    }
    return result;
  }

  private validateDetailUrl(tender: NormalizedTender): string {
    if (tender.source !== TenderSource.KAPT) {
      throw new TenderEnrichmentError("ENRICHMENT_SOURCE_MISMATCH");
    }
    try {
      const url = new URL(tender.sourceUrl);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.hostname !== KAPT_DETAIL_HOST ||
        url.port !== "" ||
        url.hash !== "" ||
        url.pathname !== DETAIL_PATH ||
        url.searchParams.getAll("bidNum").length !== 1 ||
        url.searchParams.get("bidNum") !== tender.sourceNoticeId ||
        [...url.searchParams.keys()].some((key) => key !== "bidNum")
      ) {
        throw new Error();
      }
      url.hash = "";
      return url.toString();
    } catch {
      throw new TenderEnrichmentError("ENRICHMENT_NOTICE_MISMATCH");
    }
  }

  private async readBoundedText(response: Response): Promise<string> {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PAGE_BYTES) {
      throw new TenderEnrichmentError("KAPT_PAGE_TOO_LARGE");
    }
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PAGE_BYTES) {
          await reader.cancel().catch(() => undefined);
          throw new TenderEnrichmentError("KAPT_PAGE_TOO_LARGE");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  private readDocuments(
    html: string,
    detailUrl: string,
    tender: NormalizedTender,
  ): TenderDocumentReference[] {
    const documents: TenderDocumentReference[] = [];
    const anchorPattern =
      /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorPattern.exec(html)) !== null) {
      const href = decodeHtml(match[1] ?? match[2] ?? "").trim();
      const displayName = stripTags(match[3] ?? "");
      if (!href || !displayName) continue;
      try {
        const url = new URL(href, detailUrl);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          !KAPT_HOSTS.has(url.hostname) ||
          url.port !== "" ||
          url.pathname !== ATTACHMENT_PATH ||
          url.searchParams.getAll("bidNum").length !== 1 ||
          url.searchParams.get("bidNum") !== tender.sourceNoticeId
        ) {
          continue;
        }
        url.hash = "";
        const fileSequence =
          url.searchParams.get("fileSeq") ?? String(documents.length + 1);
        documents.push({
          identity: `KAPT:${tender.sourceNoticeId}:${tender.revision}:${fileSequence}`,
          url: url.toString(),
          displayName,
          formatHint:
            formatFromName(displayName) ?? formatFromName(url.pathname),
          source: "KAPT_PAGE",
          sourceNoticeId: tender.sourceNoticeId,
          revision: tender.revision,
          evidence: {
            source: "KAPT_PAGE",
            operation: "KAPT_NOTICE_DOCUMENTS",
            field: `attachment:${fileSequence}`,
          },
        });
      } catch {
        continue;
      }
    }
    return documents;
  }

  private failure(errorCode: string, httpStatus: number | null) {
    return {
      operation: "KAPT_NOTICE_DOCUMENTS",
      errorCode,
      pageNo: null,
      providerResultCode: null,
      httpStatus,
      attempts: 1,
    };
  }
}

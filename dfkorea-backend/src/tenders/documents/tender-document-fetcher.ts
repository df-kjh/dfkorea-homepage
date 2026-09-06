import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import {
  TenderDocumentFetcherContract,
  TenderDocumentFetchResult,
  TenderDocumentFormat,
  TenderDocumentReference,
} from "../domain/tender-enrichment";

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const G2B_HOSTS = new Set(["g2b.go.kr", "www.g2b.go.kr", "apis.data.go.kr"]);
const KAPT_HOSTS = new Set(["k-apt.go.kr", "www.k-apt.go.kr"]);

export type TenderDocumentFetchErrorCode =
  | "DOCUMENT_OFF_ALLOWLIST"
  | "DOCUMENT_TOO_LARGE"
  | "DOCUMENT_FORMAT_MISMATCH"
  | "DOCUMENT_TIMEOUT"
  | "DOCUMENT_REDIRECT_LIMIT"
  | "DOCUMENT_ABORTED"
  | "DOCUMENT_HTTP_ERROR"
  | "DOCUMENT_NETWORK_ERROR";

export class TenderDocumentFetchError extends Error {
  constructor(readonly code: TenderDocumentFetchErrorCode) {
    super(`Tender document fetch error: ${code}`);
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "TenderDocumentFetchError",
    });
  }
}

type ResolveHost = (hostname: string) => Promise<string[]>;
type Fetcher = (
  url: string,
  init: RequestInit,
  validatedAddress: string,
) => Promise<Response>;

export interface TenderDocumentFetcherOptions {
  timeoutMs?: number;
  resolveHost?: ResolveHost;
  fetcher?: Fetcher;
}

const offAllowlist = () =>
  new TenderDocumentFetchError("DOCUMENT_OFF_ALLOWLIST");

const defaultResolveHost: ResolveHost = async (hostname) =>
  (await dns.lookup(hostname, { all: true, verbatim: true })).map(
    ({ address }) => address,
  );

const defaultFetcher: Fetcher = (urlText, init, validatedAddress) =>
  new Promise<Response>((resolve, reject) => {
    const url = new URL(urlText);
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: { accept: "*/*" },
        signal: init.signal ?? undefined,
        servername: url.hostname,
        lookup: (_hostname, _options, callback) => {
          callback(null, validatedAddress, isIP(validatedAddress));
        },
      },
      (incoming) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(name, item);
          } else if (value !== undefined) {
            headers.set(name, value);
          }
        }
        resolve(
          new Response(Readable.toWeb(incoming) as ReadableStream<Uint8Array>, {
            status: incoming.statusCode ?? 502,
            headers,
          }),
        );
      },
    );
    request.once("error", reject);
    request.end();
  });

export class TenderDocumentFetcher implements TenderDocumentFetcherContract {
  private readonly timeoutMs: number;
  private readonly resolveHost: ResolveHost;
  private readonly fetcher: Fetcher;

  constructor(options: TenderDocumentFetcherOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.resolveHost = options.resolveHost ?? defaultResolveHost;
    this.fetcher = options.fetcher ?? defaultFetcher;
  }

  async fetch(
    document: TenderDocumentReference,
    signal: AbortSignal,
  ): Promise<TenderDocumentFetchResult> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    signal.addEventListener("abort", abortFromCaller, { once: true });
    if (signal.aborted) controller.abort();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      let currentUrl = this.validateUrl(document.url, document);
      for (let redirectCount = 0; ; redirectCount += 1) {
        const address = await this.resolveAndValidate(
          currentUrl.hostname,
          controller.signal,
        );
        let response: Response;
        try {
          response = await this.fetcher(
            currentUrl.toString(),
            { method: "GET", redirect: "manual", signal: controller.signal },
            address,
          );
        } catch (error) {
          if (timedOut) {
            throw new TenderDocumentFetchError("DOCUMENT_TIMEOUT");
          }
          if (signal.aborted) {
            throw new TenderDocumentFetchError("DOCUMENT_ABORTED");
          }
          if (error instanceof TenderDocumentFetchError) throw error;
          throw new TenderDocumentFetchError("DOCUMENT_NETWORK_ERROR");
        }

        if (REDIRECT_STATUSES.has(response.status)) {
          if (redirectCount >= MAX_REDIRECTS) {
            await response.body?.cancel().catch(() => undefined);
            throw new TenderDocumentFetchError("DOCUMENT_REDIRECT_LIMIT");
          }
          const location = response.headers.get("location");
          await response.body?.cancel().catch(() => undefined);
          if (!location) {
            throw new TenderDocumentFetchError("DOCUMENT_HTTP_ERROR");
          }
          try {
            currentUrl = this.validateUrl(
              new URL(location, currentUrl).toString(),
              document,
            );
          } catch (error) {
            if (error instanceof TenderDocumentFetchError) throw error;
            throw offAllowlist();
          }
          continue;
        }

        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          throw new TenderDocumentFetchError("DOCUMENT_HTTP_ERROR");
        }
        const bytes = await this.readBoundedBody(response);
        const detectedFormat = this.detectFormat(bytes);
        this.validateFormat(
          detectedFormat,
          document.formatHint,
          response.headers.get("content-type"),
        );
        return {
          bytes,
          detectedFormat,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      }
    } catch (error) {
      if (error instanceof TenderDocumentFetchError) throw error;
      if (timedOut) throw new TenderDocumentFetchError("DOCUMENT_TIMEOUT");
      if (signal.aborted)
        throw new TenderDocumentFetchError("DOCUMENT_ABORTED");
      throw new TenderDocumentFetchError("DOCUMENT_NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abortFromCaller);
    }
  }

  private validateUrl(value: string, document: TenderDocumentReference): URL {
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.hash
      ) {
        throw offAllowlist();
      }
      if (document.source === "G2B_API") {
        if (
          !G2B_HOSTS.has(url.hostname) ||
          document.evidence.source !== "G2B_API" ||
          document.evidence.operation !== "getBidPblancListInfoThng" ||
          !/^ntceSpecDocUrl(?:[1-9]|10)$/.test(document.evidence.field) ||
          !document.identity.startsWith(
            `G2B:${document.sourceNoticeId}:${document.revision}:`,
          )
        ) {
          throw offAllowlist();
        }
        const noticeNumberValues = [
          ...url.searchParams.getAll("bidNtceNo"),
          ...url.searchParams.getAll("bidno"),
        ];
        if (noticeNumberValues.length > 1) throw offAllowlist();
        const urlNoticeId = noticeNumberValues[0];
        if (urlNoticeId && urlNoticeId !== document.sourceNoticeId) {
          throw offAllowlist();
        }
      } else if (document.source === "KAPT_PAGE") {
        if (
          !KAPT_HOSTS.has(url.hostname) ||
          url.pathname !== "/bid/fileDownload.do" ||
          url.searchParams.getAll("bidNum").length !== 1 ||
          url.searchParams.get("bidNum") !== document.sourceNoticeId ||
          document.evidence.source !== "KAPT_PAGE" ||
          document.evidence.operation !== "KAPT_NOTICE_DOCUMENTS" ||
          !document.identity.startsWith(
            `KAPT:${document.sourceNoticeId}:${document.revision}:`,
          )
        ) {
          throw offAllowlist();
        }
      } else {
        throw offAllowlist();
      }
      return url;
    } catch (error) {
      if (error instanceof TenderDocumentFetchError) throw error;
      throw offAllowlist();
    }
  }

  private async resolveAndValidate(
    hostname: string,
    signal: AbortSignal,
  ): Promise<string> {
    let addresses: string[];
    let abortListener: (() => void) | undefined;
    try {
      const aborted = new Promise<never>((_resolve, reject) => {
        abortListener = () => reject(new Error("document fetch aborted"));
        signal.addEventListener("abort", abortListener, { once: true });
      });
      if (signal.aborted) abortListener();
      addresses = await Promise.race([this.resolveHost(hostname), aborted]);
    } catch {
      if (signal.aborted) throw new Error("document fetch aborted");
      throw offAllowlist();
    } finally {
      if (abortListener) signal.removeEventListener("abort", abortListener);
    }
    if (
      addresses.length === 0 ||
      addresses.some((address) => !this.isPublicIp(address))
    ) {
      throw offAllowlist();
    }
    return addresses[0]!;
  }

  private isPublicIp(address: string): boolean {
    // Official hosts must never resolve through private, link-local, benchmark,
    // documentation, multicast, or other non-global address space.
    const family = isIP(address);
    if (family === 4) {
      const parts = address.split(".").map(Number);
      const [a, b] = parts;
      if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255))
        return false;
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b! >= 64 && b! <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b! >= 16 && b! <= 31) ||
        (a === 192 &&
          (b === 0 || b === 168 || (b === 88 && parts[2] === 99))) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && parts[2] === 100) ||
        (a === 203 && b === 0 && parts[2] === 113) ||
        a! >= 224
      );
    }
    if (family === 6) {
      const normalized = address.toLowerCase().split("%")[0]!;
      if (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        /^fe[89ab]/.test(normalized) ||
        normalized.startsWith("ff") ||
        !/^[23]/.test(normalized) ||
        normalized.startsWith("2001:db8:")
      ) {
        return false;
      }
      const mapped = /(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized)?.[1];
      return mapped ? this.isPublicIp(mapped) : true;
    }
    return false;
  }

  private async readBoundedBody(response: Response): Promise<Uint8Array> {
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_DOCUMENT_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new TenderDocumentFetchError("DOCUMENT_TOO_LARGE");
    }
    if (!response.body) return new Uint8Array();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_DOCUMENT_BYTES) {
          await reader.cancel().catch(() => undefined);
          throw new TenderDocumentFetchError("DOCUMENT_TOO_LARGE");
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
    return bytes;
  }

  private detectFormat(bytes: Uint8Array): TenderDocumentFormat {
    if (this.startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "PDF";
    if (
      this.startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    ) {
      return "HWP";
    }
    if (this.startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
      const containerText = Buffer.from(bytes).toString("latin1");
      if (
        containerText.includes("Contents/") ||
        containerText.includes("application/hwp+zip")
      ) {
        return "HWPX";
      }
      if (containerText.includes("word/")) return "DOCX";
      if (containerText.includes("xl/")) return "XLSX";
    }
    throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
  }

  private startsWith(bytes: Uint8Array, signature: number[]): boolean {
    return signature.every((value, index) => bytes[index] === value);
  }

  private validateFormat(
    detected: TenderDocumentFormat,
    hint: TenderDocumentFormat | null,
    contentTypeHeader: string | null,
  ): void {
    if (hint && hint !== detected) {
      throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
    }
    const contentType = contentTypeHeader
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || contentType === "application/octet-stream") return;
    const allowedMime: Record<TenderDocumentFormat, ReadonlySet<string>> = {
      PDF: new Set(["application/pdf"]),
      HWP: new Set(["application/x-hwp", "application/haansofthwp"]),
      HWPX: new Set(["application/hwp+zip", "application/zip"]),
      DOCX: new Set([
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
      ]),
      XLSX: new Set([
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
      ]),
    };
    if (!allowedMime[detected].has(contentType)) {
      throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
    }
  }
}

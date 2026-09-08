import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import {
  isIssuedTenderDocumentReference,
  TenderDocumentFetcherContract,
  TenderDocumentFetchResult,
  TenderDocumentFormat,
  TenderDocumentReference,
} from "../domain/tender-enrichment";
import { parseValidatedG2bDocumentUrl } from "./g2b-document-url";

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_CONTAINER_ENTRIES = 4_096;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const KAPT_HOSTS = new Set(["k-apt.go.kr", "www.k-apt.go.kr"]);
const LH_HOST = "ebid.lh.or.kr";
const LH_DOWNLOAD_PATH = "/ebid.framework.download.dev";
const ZIP_COMMON_FLAGS = 0x0808;
// PKWARE APPNOTE 4.4.4 assigns bits 1-2 to compression-speed hints only
// for Deflate. The same bits describe unsupported features for other methods.
const ZIP_DEFLATE_OPTION_FLAGS = 0x0006;

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

const formatFromName = (name: string): TenderDocumentFormat | null => {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toUpperCase();
  return extension === "PDF" ||
    extension === "HWP" ||
    extension === "HWPX" ||
    extension === "DOCX" ||
    extension === "XLSX" ||
    extension === "ZIP"
    ? extension
    : null;
};

const defaultResolveHost: ResolveHost = async (hostname) =>
  (await dns.lookup(hostname, { all: true, verbatim: true })).map(
    ({ address }) => address,
  );

const defaultFetcher: Fetcher = (urlText, init, validatedAddress) =>
  new Promise<Response>((resolve, reject) => {
    const url = new URL(urlText);
    const headers = new Headers(init.headers);
    const request = httpsRequest(
      url,
      {
        method: init.method ?? "GET",
        headers: Object.fromEntries(headers.entries()),
        signal: init.signal ?? undefined,
        servername: url.hostname,
        lookup: (_hostname, options, callback) => {
          const family = isIP(validatedAddress);
          if (typeof options === "object" && options.all) {
            (
              callback as unknown as (
                error: null,
                addresses: Array<{ address: string; family: number }>,
              ) => void
            )(null, [{ address: validatedAddress, family }]);
            return;
          }
          callback(null, validatedAddress, family);
        },
      },
      (incoming) => {
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) headers.append(name, item);
            } else if (value !== undefined) {
              headers.set(name, value);
            }
          }
          resolve(
            new Response(
              Readable.toWeb(incoming) as ReadableStream<Uint8Array>,
              {
                status: incoming.statusCode ?? 502,
                headers,
              },
            ),
          );
        } catch (error) {
          incoming.once("error", () => undefined);
          incoming.resume();
          reject(error);
        }
      },
    );
    request.once("error", reject);
    if (typeof init.body === "string") request.write(init.body);
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
          const init = this.requestInit(document, controller.signal);
          response = await this.fetcher(
            this.transportUrl(currentUrl, document),
            init,
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
          if (
            document.source === "LH_PAGE" &&
            (response.status === 301 ||
              response.status === 302 ||
              response.status === 303)
          ) {
            throw offAllowlist();
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
          document.source,
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
        !isIssuedTenderDocumentReference(document) ||
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.hash
      ) {
        throw offAllowlist();
      }
      if (document.source === "G2B_API") {
        const evidenceMatch = /^ntceSpecDocUrl([1-9]|10)$/.exec(
          document.evidence.field,
        );
        const fileSequence = Number(evidenceMatch?.[1]);
        if (
          document.evidence.source !== "G2B_API" ||
          document.evidence.operation !== "getBidPblancListInfoThng" ||
          !Number.isInteger(fileSequence) ||
          document.identity !==
            `G2B:${document.sourceNoticeId}:${document.revision}:${fileSequence}` ||
          !parseValidatedG2bDocumentUrl(url.toString(), {
            sourceNoticeId: document.sourceNoticeId,
            revision: document.revision,
            fileSequence,
          })
        ) {
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
      } else if (document.source === "LH_PAGE") {
        this.validateLhReference(url, document);
      } else {
        throw offAllowlist();
      }
      return url;
    } catch (error) {
      if (error instanceof TenderDocumentFetchError) throw error;
      throw offAllowlist();
    }
  }

  private validateLhReference(
    url: URL,
    document: TenderDocumentReference,
  ): void {
    const sequence = /^attachment:([1-9]\d{0,31})$/.exec(
      document.evidence.field,
    )?.[1];
    const keys = [
      "noticeId",
      "revision",
      "sequence",
      "displayName",
      "savedName",
    ];
    const savedName = url.searchParams.get("savedName");
    if (
      url.hostname !== LH_HOST ||
      url.pathname !== LH_DOWNLOAD_PATH ||
      document.evidence.source !== "LH_PAGE" ||
      document.evidence.operation !== "LH_NOTICE_DOCUMENTS" ||
      !sequence ||
      document.identity !==
        `LH:${document.sourceNoticeId}:${document.revision}:${sequence}` ||
      [...url.searchParams.keys()].length !== keys.length ||
      [...url.searchParams.keys()].some(
        (key) => !keys.includes(key) || url.searchParams.getAll(key).length !== 1,
      ) ||
      url.searchParams.get("noticeId") !== document.sourceNoticeId ||
      url.searchParams.get("revision") !== document.revision ||
      url.searchParams.get("sequence") !== sequence ||
      url.searchParams.get("displayName") !== document.displayName ||
      document.displayName.length === 0 ||
      document.displayName.length > 512 ||
      /[\0\r\n]/.test(document.displayName) ||
      document.formatHint !== formatFromName(document.displayName) ||
      !savedName ||
      savedName.length > 512 ||
      /[\0\r\n\\/]/.test(savedName) ||
      savedName === "." ||
      savedName === ".."
    ) {
      throw offAllowlist();
    }
  }

  private requestInit(
    document: TenderDocumentReference,
    signal: AbortSignal,
  ): RequestInit {
    if (document.source !== "LH_PAGE") {
      return {
        method: "GET",
        headers: { accept: "*/*" },
        redirect: "manual",
        signal,
      };
    }
    const metadata = new URL(document.url).searchParams;
    const body = new URLSearchParams();
    body.set("download.filespec", "bidinfo");
    body.set("download.filename", metadata.get("displayName")!);
    body.set("download.savedname", metadata.get("savedName")!);
    body.set("download.bidnum", "");
    return {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
      redirect: "manual",
      signal,
    };
  }

  private transportUrl(
    url: URL,
    document: TenderDocumentReference,
  ): string {
    if (document.source !== "LH_PAGE") return url.toString();
    return `${url.origin}${url.pathname}`;
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
      if (this.isHwpCompoundFile(bytes)) return "HWP";
      throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
    }
    if (this.startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
      const entries = this.readZipEntries(bytes);
      if (
        entries.has("META-INF/container.xml") &&
        entries.has("Contents/content.hpf") &&
        [...entries].some((entry) => /^Contents\/section\d+\.xml$/.test(entry))
      ) {
        return "HWPX";
      }
      if (
        entries.has("[Content_Types].xml") &&
        entries.has("word/document.xml")
      ) {
        return "DOCX";
      }
      if (
        entries.has("[Content_Types].xml") &&
        entries.has("xl/workbook.xml")
      ) {
        return "XLSX";
      }
      return "ZIP";
    }
    throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
  }

  private readZipEntries(bytes: Uint8Array): Set<string> {
    // Detection walks the bounded central directory and matching local headers
    // without inflating content. Task 4 owns decompression and archive-bomb limits.
    try {
      const buffer = Buffer.from(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      const minimumEndOffset = Math.max(0, buffer.length - 65_557);
      let endOffset = -1;
      for (
        let offset = buffer.length - 22;
        offset >= minimumEndOffset;
        offset -= 1
      ) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
          endOffset = offset;
          break;
        }
      }
      if (endOffset < 0) throw new Error();
      const commentLength = buffer.readUInt16LE(endOffset + 20);
      if (endOffset + 22 + commentLength !== buffer.length) throw new Error();
      if (
        buffer.readUInt16LE(endOffset + 4) !== 0 ||
        buffer.readUInt16LE(endOffset + 6) !== 0 ||
        (endOffset >= 20 && buffer.readUInt32LE(endOffset - 20) === 0x07064b50)
      ) {
        throw new Error();
      }
      const diskEntries = buffer.readUInt16LE(endOffset + 8);
      const entryCount = buffer.readUInt16LE(endOffset + 10);
      const centralSize = buffer.readUInt32LE(endOffset + 12);
      const centralOffset = buffer.readUInt32LE(endOffset + 16);
      if (
        entryCount === 0 ||
        entryCount === 0xffff ||
        entryCount !== diskEntries ||
        entryCount > MAX_CONTAINER_ENTRIES ||
        centralSize === 0xffffffff ||
        centralOffset === 0xffffffff ||
        centralOffset + centralSize !== endOffset
      ) {
        throw new Error();
      }

      const entries = new Set<string>();
      const localRecords: Array<{
        bitThree: boolean;
        compressedSize: number;
        crc32: number;
        dataOffset: number;
        localOffset: number;
        uncompressedSize: number;
      }> = [];
      const containsZip64Extra = (start: number, length: number): boolean => {
        const end = start + length;
        if (end > buffer.length) throw new Error();
        let extraOffset = start;
        while (extraOffset < end) {
          if (extraOffset + 4 > end) throw new Error();
          const headerId = buffer.readUInt16LE(extraOffset);
          const dataLength = buffer.readUInt16LE(extraOffset + 2);
          extraOffset += 4;
          if (extraOffset + dataLength > end) throw new Error();
          if (headerId === 0x0001) return true;
          extraOffset += dataLength;
        }
        return false;
      };
      let offset = centralOffset;
      for (let index = 0; index < entryCount; index += 1) {
        if (offset + 46 > endOffset) throw new Error();
        if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error();
        const flags = buffer.readUInt16LE(offset + 8);
        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const crc32 = buffer.readUInt32LE(offset + 16);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const entryCommentLength = buffer.readUInt16LE(offset + 32);
        const diskStart = buffer.readUInt16LE(offset + 34);
        const localOffset = buffer.readUInt32LE(offset + 42);
        const allowedFlags =
          ZIP_COMMON_FLAGS |
          (compressionMethod === 8 ? ZIP_DEFLATE_OPTION_FLAGS : 0x0000);
        const nextOffset =
          offset + 46 + nameLength + extraLength + entryCommentLength;
        if (
          nameLength === 0 ||
          nextOffset > endOffset ||
          diskStart !== 0 ||
          compressedSize === 0xffffffff ||
          uncompressedSize === 0xffffffff ||
          localOffset === 0xffffffff ||
          (flags & ~allowedFlags) !== 0 ||
          (compressionMethod !== 0 && compressionMethod !== 8) ||
          (compressionMethod === 0 && compressedSize !== uncompressedSize) ||
          containsZip64Extra(offset + 46 + nameLength, extraLength)
        ) {
          throw new Error();
        }
        const name = buffer.toString(
          "utf8",
          offset + 46,
          offset + 46 + nameLength,
        );
        if (!name || name.includes("\0") || entries.has(name))
          throw new Error();

        if (localOffset + 30 > centralOffset) throw new Error();
        if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error();
        const localFlags = buffer.readUInt16LE(localOffset + 6);
        const localCompressionMethod = buffer.readUInt16LE(localOffset + 8);
        const localCrc32 = buffer.readUInt32LE(localOffset + 14);
        const localCompressedSize = buffer.readUInt32LE(localOffset + 18);
        const localUncompressedSize = buffer.readUInt32LE(localOffset + 22);
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const localDataOffset =
          localOffset + 30 + localNameLength + localExtraLength;
        const bitThree = (flags & 0x0008) !== 0;
        if (
          localCompressedSize === 0xffffffff ||
          localUncompressedSize === 0xffffffff ||
          localFlags !== flags ||
          localCompressionMethod !== compressionMethod ||
          localDataOffset > centralOffset ||
          containsZip64Extra(
            localOffset + 30 + localNameLength,
            localExtraLength,
          ) ||
          buffer.toString(
            "utf8",
            localOffset + 30,
            localOffset + 30 + localNameLength,
          ) !== name ||
          (bitThree
            ? localCrc32 !== 0 ||
              localCompressedSize !== 0 ||
              localUncompressedSize !== 0
            : localCrc32 !== crc32 ||
              localCompressedSize !== compressedSize ||
              localUncompressedSize !== uncompressedSize)
        ) {
          throw new Error();
        }
        entries.add(name);
        localRecords.push({
          bitThree,
          compressedSize,
          crc32,
          dataOffset: localDataOffset,
          localOffset,
          uncompressedSize,
        });
        offset = nextOffset;
      }
      if (offset !== endOffset) throw new Error();

      localRecords.sort((left, right) => left.localOffset - right.localOffset);
      for (let index = 0; index < localRecords.length; index += 1) {
        const record = localRecords[index]!;
        const nextBoundary =
          localRecords[index + 1]?.localOffset ?? centralOffset;
        const dataEnd = record.dataOffset + record.compressedSize;
        if (
          (index > 0 &&
            record.localOffset === localRecords[index - 1]!.localOffset) ||
          record.dataOffset > nextBoundary ||
          dataEnd > nextBoundary
        ) {
          throw new Error();
        }
        if (!record.bitThree) continue;

        const signedDescriptorMatches =
          dataEnd + 16 <= nextBoundary &&
          buffer.readUInt32LE(dataEnd) === 0x08074b50 &&
          buffer.readUInt32LE(dataEnd + 4) === record.crc32 &&
          buffer.readUInt32LE(dataEnd + 8) === record.compressedSize &&
          buffer.readUInt32LE(dataEnd + 12) === record.uncompressedSize;
        const unsignedDescriptorMatches =
          dataEnd + 12 <= nextBoundary &&
          buffer.readUInt32LE(dataEnd) === record.crc32 &&
          buffer.readUInt32LE(dataEnd + 4) === record.compressedSize &&
          buffer.readUInt32LE(dataEnd + 8) === record.uncompressedSize;
        if (!signedDescriptorMatches && !unsignedDescriptorMatches) {
          throw new Error();
        }
      }
      return entries;
    } catch {
      throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
    }
  }

  private isHwpCompoundFile(bytes: Uint8Array): boolean {
    // A generic OLE signature is insufficient for HWP. Read only the bounded CFB
    // allocation metadata needed to locate the root-level FileHeader stream.
    try {
      const buffer = Buffer.from(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      if (
        buffer.length < 512 ||
        buffer.readUInt16LE(28) !== 0xfffe ||
        buffer.readUInt16LE(32) !== 6
      ) {
        return false;
      }
      const majorVersion = buffer.readUInt16LE(26);
      const sectorShift = buffer.readUInt16LE(30);
      if (
        (majorVersion !== 3 && majorVersion !== 4) ||
        sectorShift !== (majorVersion === 3 ? 9 : 12)
      ) {
        return false;
      }
      const sectorSize = 2 ** sectorShift;
      const miniSectorSize = 2 ** buffer.readUInt16LE(32);
      const sectorBase = majorVersion === 3 ? 512 : sectorSize;
      const totalSectors = Math.floor(
        (buffer.length - sectorBase) / sectorSize,
      );
      if (
        totalSectors <= 0 ||
        sectorBase + totalSectors * sectorSize !== buffer.length
      ) {
        return false;
      }
      const sector = (id: number): Buffer => {
        if (!Number.isInteger(id) || id < 0 || id >= totalSectors)
          throw new Error();
        const offset = sectorBase + id * sectorSize;
        return buffer.subarray(offset, offset + sectorSize);
      };

      const fatSectorCount = buffer.readUInt32LE(44);
      if (fatSectorCount === 0 || fatSectorCount > totalSectors) return false;
      const fatSectorIds: number[] = [];
      for (
        let offset = 76;
        offset < 512 && fatSectorIds.length < fatSectorCount;
        offset += 4
      ) {
        const id = buffer.readUInt32LE(offset);
        if (id !== 0xffffffff) fatSectorIds.push(id);
      }
      let difatSector = buffer.readUInt32LE(68);
      const difatSectorCount = buffer.readUInt32LE(72);
      const seenDifat = new Set<number>();
      for (let index = 0; index < difatSectorCount; index += 1) {
        if (seenDifat.has(difatSector)) throw new Error();
        seenDifat.add(difatSector);
        const current = sector(difatSector);
        for (let offset = 0; offset < sectorSize - 4; offset += 4) {
          const id = current.readUInt32LE(offset);
          if (id !== 0xffffffff && fatSectorIds.length < fatSectorCount) {
            fatSectorIds.push(id);
          }
        }
        difatSector = current.readUInt32LE(sectorSize - 4);
      }
      if (fatSectorIds.length !== fatSectorCount) return false;
      const fat = fatSectorIds.flatMap((id) => {
        const current = sector(id);
        const entries: number[] = [];
        for (let offset = 0; offset < sectorSize; offset += 4) {
          entries.push(current.readUInt32LE(offset));
        }
        return entries;
      });
      const readChain = (
        start: number,
        table: number[],
        maximumLength = totalSectors,
        maximumIndex = totalSectors,
      ): number[] => {
        const chain: number[] = [];
        const seen = new Set<number>();
        let current = start;
        while (current !== 0xfffffffe) {
          if (
            current < 0 ||
            current >= table.length ||
            current >= maximumIndex ||
            seen.has(current) ||
            chain.length >= maximumLength
          ) {
            throw new Error();
          }
          seen.add(current);
          chain.push(current);
          current = table[current]!;
        }
        return chain;
      };
      const readRegularChain = (start: number): Buffer =>
        Buffer.concat(readChain(start, fat).map(sector));

      const directoryBytes = readRegularChain(buffer.readUInt32LE(48));
      const directoryEntries: Array<{
        name: string;
        type: number;
        left: number;
        right: number;
        child: number;
        start: number;
        size: number;
      } | null> = [];
      for (
        let offset = 0;
        offset + 128 <= directoryBytes.length;
        offset += 128
      ) {
        const nameLength = directoryBytes.readUInt16LE(offset + 64);
        const type = directoryBytes.readUInt8(offset + 66);
        if (type === 0) {
          directoryEntries.push(null);
          continue;
        }
        if (nameLength < 2 || nameLength > 64 || nameLength % 2 !== 0) {
          throw new Error();
        }
        const name = directoryBytes
          .toString("utf16le", offset, offset + nameLength - 2)
          .replace(/\0.*$/, "");
        const sizeBig = directoryBytes.readBigUInt64LE(offset + 120);
        if (sizeBig > BigInt(MAX_DOCUMENT_BYTES)) throw new Error();
        directoryEntries.push({
          name,
          type,
          left: directoryBytes.readUInt32LE(offset + 68),
          right: directoryBytes.readUInt32LE(offset + 72),
          child: directoryBytes.readUInt32LE(offset + 76),
          start: directoryBytes.readUInt32LE(offset + 116),
          size: Number(sizeBig),
        });
      }
      const rootEntry = directoryEntries.find(
        (entry) => entry?.type === 5 && entry.name === "Root Entry",
      );
      if (!rootEntry) return false;
      const reachable = new Set<number>();
      const visitDirectoryTree = (id: number): void => {
        if (id === 0xffffffff) return;
        if (id < 0 || id >= directoryEntries.length || reachable.has(id)) {
          throw new Error();
        }
        reachable.add(id);
        const entry = directoryEntries[id];
        if (!entry) throw new Error();
        visitDirectoryTree(entry.left);
        visitDirectoryTree(entry.right);
      };
      visitDirectoryTree(rootEntry.child);
      const fileHeaderEntry = [...reachable]
        .map((id) => directoryEntries[id])
        .find((entry) => entry?.type === 2 && entry.name === "FileHeader");
      if (!rootEntry || !fileHeaderEntry || fileHeaderEntry.size === 0)
        return false;

      let fileHeader: Buffer;
      const miniCutoff = buffer.readUInt32LE(56);
      if (fileHeaderEntry.size < miniCutoff) {
        const miniFatSectorCount = buffer.readUInt32LE(64);
        if (miniFatSectorCount === 0 || miniFatSectorCount > totalSectors)
          return false;
        const miniFatChain = readChain(buffer.readUInt32LE(60), fat);
        if (miniFatChain.length !== miniFatSectorCount) return false;
        const miniFatBytes = Buffer.concat(miniFatChain.map(sector));
        const miniFat: number[] = [];
        for (
          let offset = 0;
          offset + 4 <= miniFatBytes.length &&
          miniFat.length < miniFatSectorCount * (sectorSize / 4);
          offset += 4
        ) {
          miniFat.push(miniFatBytes.readUInt32LE(offset));
        }
        const rootMiniStreamBytes = readRegularChain(rootEntry.start);
        if (rootMiniStreamBytes.length < rootEntry.size) throw new Error();
        const rootMiniStream = rootMiniStreamBytes.subarray(0, rootEntry.size);
        const maximumMiniSectors = Math.floor(
          rootMiniStream.length / miniSectorSize,
        );
        const miniChain = readChain(
          fileHeaderEntry.start,
          miniFat,
          maximumMiniSectors,
          maximumMiniSectors,
        );
        const fileHeaderBytes = Buffer.concat(
          miniChain.map((id) => {
            const offset = id * miniSectorSize;
            if (offset + miniSectorSize > rootMiniStream.length)
              throw new Error();
            return rootMiniStream.subarray(offset, offset + miniSectorSize);
          }),
        );
        if (fileHeaderBytes.length < fileHeaderEntry.size) throw new Error();
        fileHeader = fileHeaderBytes.subarray(0, fileHeaderEntry.size);
      } else {
        const fileHeaderBytes = readRegularChain(fileHeaderEntry.start);
        if (fileHeaderBytes.length < fileHeaderEntry.size) throw new Error();
        fileHeader = fileHeaderBytes.subarray(0, fileHeaderEntry.size);
      }
      return (
        fileHeader.subarray(0, 17).toString("ascii") === "HWP Document File"
      );
    } catch {
      return false;
    }
  }

  private startsWith(bytes: Uint8Array, signature: number[]): boolean {
    return signature.every((value, index) => bytes[index] === value);
  }

  private validateFormat(
    detected: TenderDocumentFormat,
    hint: TenderDocumentFormat | null,
    contentTypeHeader: string | null,
    source: TenderDocumentReference["source"],
  ): void {
    if (hint && hint !== detected) {
      throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
    }
    const contentType = contentTypeHeader
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || contentType === "application/octet-stream") return;
    // LH's public download endpoint has historically emitted this exact typo.
    // Treat it as generic binary only after magic bytes and the issued hint agree.
    if (source === "LH_PAGE" && contentType === "application/octect-stream")
      return;
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
      ZIP: new Set(["application/zip", "application/x-zip-compressed"]),
    };
    if (!allowedMime[detected].has(contentType)) {
      throw new TenderDocumentFetchError("DOCUMENT_FORMAT_MISMATCH");
    }
  }
}

import { EventEmitter } from "node:events";
import {
  createServer,
  IncomingHttpHeaders,
  IncomingMessage,
  Server,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { deflateRawSync } from "node:zlib";
import {
  TenderDocumentFetchError,
  TenderDocumentFetcher,
} from "./tender-document-fetcher";
import {
  issueTenderDocumentReference,
  TenderDocumentReference,
} from "../domain/tender-enrichment";

jest.mock("node:https", () => ({ request: jest.fn() }));

const httpsRequestMock = httpsRequest as jest.MockedFunction<
  typeof httpsRequest
>;

interface MockClientRequest extends EventEmitter {
  end(): void;
}

const incomingResponse = (statusCode: number): IncomingMessage => {
  const incoming = Readable.from([]) as IncomingMessage;
  incoming.statusCode = statusCode;
  incoming.headers = {} as IncomingHttpHeaders;
  return incoming;
};

const pdfBytes = Buffer.from("%PDF-1.7\nfixture");
const hwpBytes = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00,
]);

const createStoredZip = (
  entryNames: string[],
  options: { dataDescriptors?: boolean } = {},
): Buffer => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const entryName of entryNames) {
    const name = Buffer.from(entryName, "utf8");
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(options.dataDescriptors ? 0x0008 : 0, 6);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local);
    if (options.dataDescriptors) {
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0);
      localParts.push(descriptor);
    }

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(options.dataDescriptors ? 0x0008 : 0, 8);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length + (options.dataDescriptors ? 16 : 0);
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entryNames.length, 8);
  end.writeUInt16LE(entryNames.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, central, end]);
};

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createDeflatedZip = (entryNames: string[], flags: number): Buffer => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const entryName of entryNames) {
    const name = Buffer.from(entryName, "utf8");
    const contents = Buffer.from(`<fixture entry="${entryName}"/>`, "utf8");
    const compressed = deflateRawSync(contents);
    const checksum = crc32(contents);
    const local = Buffer.alloc(30 + name.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    compressed.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(contents.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entryNames.length, 8);
  end.writeUInt16LE(entryNames.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, central, end]);
};

const mutateZip = (zip: Buffer, mutate: (copy: Buffer) => void): Buffer => {
  const copy = Buffer.from(zip);
  mutate(copy);
  return copy;
};

const centralOffset = (zip: Buffer): number =>
  zip.readUInt32LE(zip.length - 22 + 16);

const firstLocalDataOffset = (zip: Buffer): number =>
  30 + zip.readUInt16LE(26) + zip.readUInt16LE(28);

const createHwpCompoundFile = (): Buffer => {
  const file = Buffer.alloc(512 * 5);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(file, 0);
  file.writeUInt16LE(0x003e, 24);
  file.writeUInt16LE(3, 26);
  file.writeUInt16LE(0xfffe, 28);
  file.writeUInt16LE(9, 30);
  file.writeUInt16LE(6, 32);
  file.writeUInt32LE(1, 44);
  file.writeUInt32LE(1, 48);
  file.writeUInt32LE(4096, 56);
  file.writeUInt32LE(2, 60);
  file.writeUInt32LE(1, 64);
  file.writeUInt32LE(0xfffffffe, 68);
  for (let offset = 76; offset < 512; offset += 4) {
    file.writeUInt32LE(0xffffffff, offset);
  }
  file.writeUInt32LE(0, 76);

  const fatOffset = 512;
  for (let offset = fatOffset; offset < fatOffset + 512; offset += 4) {
    file.writeUInt32LE(0xffffffff, offset);
  }
  file.writeUInt32LE(0xfffffffd, fatOffset);
  file.writeUInt32LE(0xfffffffe, fatOffset + 4);
  file.writeUInt32LE(0xfffffffe, fatOffset + 8);
  file.writeUInt32LE(0xfffffffe, fatOffset + 12);

  const writeDirectoryEntry = (
    offset: number,
    name: string,
    type: number,
    startSector: number,
    size: number,
  ) => {
    const encodedName = Buffer.from(`${name}\0`, "utf16le");
    encodedName.copy(file, offset);
    file.writeUInt16LE(encodedName.length, offset + 64);
    file.writeUInt8(type, offset + 66);
    file.writeUInt8(1, offset + 67);
    file.writeUInt32LE(0xffffffff, offset + 68);
    file.writeUInt32LE(0xffffffff, offset + 72);
    file.writeUInt32LE(0xffffffff, offset + 76);
    file.writeUInt32LE(startSector, offset + 116);
    file.writeUInt32LE(size, offset + 120);
  };
  writeDirectoryEntry(1024, "Root Entry", 5, 3, 512);
  writeDirectoryEntry(1152, "FileHeader", 2, 0, 32);
  file.writeUInt32LE(1, 1024 + 76);

  for (let offset = 1536; offset < 2048; offset += 4) {
    file.writeUInt32LE(0xffffffff, offset);
  }
  file.writeUInt32LE(0xfffffffe, 1536);
  Buffer.from("HWP Document File", "ascii").copy(file, 2048);
  return file;
};

const createTruncatedHwpCompoundFile = (): Buffer => {
  const file = createHwpCompoundFile();
  file.writeUInt32LE(128, 1152 + 120);
  return file;
};

const g2bDocumentUrl = (fixture: string) => {
  const fixtureSequence: Record<string, number> = {
    document: 1,
    oversized: 2,
    mismatch: 3,
    slow: 4,
    offsite: 5,
  };
  const sequence = fixture === "redirect" ? 6 : fixtureSequence[fixture]!;
  const url = new URL(
    "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do",
  );
  url.searchParams.set("bidPbancNo", "R26BK01000001");
  url.searchParams.set("bidPbancOrd", "000");
  url.searchParams.set("fileType", "");
  url.searchParams.set("fileSeq", String(sequence));
  url.searchParams.set("prcmBsneSeCd", "01");
  return url.toString();
};

const document = (
  overrides: Partial<TenderDocumentReference> = {},
): TenderDocumentReference => {
  const url = overrides.url ?? g2bDocumentUrl("document");
  const fileSequence = Number(new URL(url).searchParams.get("fileSeq") ?? 1);
  return issueTenderDocumentReference({
    identity: `G2B:R26BK01000001:000:${fileSequence}`,
    url,
    displayName: "규격서.pdf",
    formatHint: "PDF",
    source: "G2B_API",
    sourceNoticeId: "R26BK01000001",
    revision: "000",
    evidence: {
      source: "G2B_API",
      operation: "getBidPblancListInfoThng",
      field: `ntceSpecDocUrl${fileSequence}`,
    },
    ...overrides,
  });
};

const lhDocument = (
  overrides: Partial<TenderDocumentReference> = {},
): TenderDocumentReference => {
  const url = new URL(
    "https://ebid.lh.or.kr/ebid.framework.download.dev",
  );
  url.searchParams.set("noticeId", "2603251");
  url.searchParams.set("revision", "00");
  url.searchParams.set("sequence", "10");
  url.searchParams.set("displayName", "공고문.zip");
  url.searchParams.set("savedName", "20260901_notice.zip");
  return issueTenderDocumentReference({
    identity: "LH:2603251:00:10",
    url: url.toString(),
    displayName: "공고문.zip",
    formatHint: "ZIP",
    source: "LH_PAGE",
    sourceNoticeId: "2603251",
    revision: "00",
    evidence: {
      source: "LH_PAGE",
      operation: "LH_NOTICE_DOCUMENTS",
      field: "attachment:10",
    },
    ...overrides,
  });
};

describe("TenderDocumentFetcher", () => {
  let server: Server;
  let origin: string;

  afterEach(() => {
    httpsRequestMock.mockReset();
  });

  beforeAll(async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url || "/", "http://local.test");
      const fileSequence =
        url.pathname === "/pn/pnp/pnpe/UntyAtchFile/downloadFile.do"
          ? Number(url.searchParams.get("fileSeq"))
          : null;
      const fixture =
        fileSequence === 1
          ? "document"
          : fileSequence === 2
            ? "oversized"
            : fileSequence === 3
              ? "mismatch"
              : fileSequence === 4
                ? "slow"
                : fileSequence === 5
                  ? "offsite"
                  : fileSequence !== null && fileSequence >= 6
                    ? "redirect"
                    : null;
      if (url.pathname === "/document.pdf" || fixture === "document") {
        response.writeHead(200, { "content-type": "application/pdf" });
        response.end(pdfBytes);
        return;
      }
      if (url.pathname === "/manufactured.pdf") {
        response.writeHead(200, { "content-type": "application/pdf" });
        response.end(pdfBytes);
        return;
      }
      if (url.pathname === "/oversized.pdf" || fixture === "oversized") {
        response.writeHead(200, { "content-type": "application/pdf" });
        response.write(
          Buffer.concat([
            pdfBytes,
            Buffer.alloc(20 * 1024 * 1024 - pdfBytes.length),
          ]),
        );
        response.end(Buffer.from([0]));
        return;
      }
      if (url.pathname === "/mismatch.pdf" || fixture === "mismatch") {
        response.writeHead(200, { "content-type": "application/pdf" });
        response.end(hwpBytes);
        return;
      }
      if (url.pathname === "/slow.pdf" || fixture === "slow") {
        setTimeout(() => {
          if (!response.destroyed) {
            response.writeHead(200, { "content-type": "application/pdf" });
            response.end(pdfBytes);
          }
        }, 250);
        return;
      }
      if (url.pathname === "/offsite.pdf" || fixture === "offsite") {
        response.writeHead(302, {
          location: "https://evil.example/document.pdf",
        });
        response.end();
        return;
      }
      if (url.pathname === "/redirect.pdf" || fixture === "redirect") {
        response.writeHead(302, {
          location: g2bDocumentUrl("redirect"),
        });
        response.end();
        return;
      }
      response.writeHead(404);
      response.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  const createFetcher = (
    options: { timeoutMs?: number; addresses?: string[] } = {},
  ) =>
    new TenderDocumentFetcher({
      timeoutMs: options.timeoutMs,
      resolveHost: async () => options.addresses ?? ["8.8.8.8"],
      fetcher: (url, init) => {
        const providerUrl = new URL(url);
        return fetch(
          `${origin}${providerUrl.pathname}${providerUrl.search}`,
          init,
        );
      },
    });

  it("returns an address array when Node production transport requests lookup all mode", async () => {
    let transportOptions: Record<string, unknown> | undefined;
    const request = new EventEmitter() as MockClientRequest;
    request.end = () => request.emit("error", new Error("transport probe"));
    httpsRequestMock.mockImplementationOnce(((
      _url: URL,
      options: Record<string, unknown>,
    ) => {
      transportOptions = options;
      return request;
    }) as never);
    const fetcher = new TenderDocumentFetcher({
      resolveHost: async () => ["8.8.8.8"],
    });

    await expect(
      fetcher.fetch(document(), new AbortController().signal),
    ).rejects.toMatchObject({ code: "DOCUMENT_NETWORK_ERROR" });

    const lookup = transportOptions?.lookup as (
      hostname: string,
      options: { all: boolean },
      callback: (...args: unknown[]) => void,
    ) => void;
    let lookupResult: unknown[] = [];
    lookup("www.g2b.go.kr", { all: true }, (...args) => {
      lookupResult = args;
    });
    expect(lookupResult).toEqual([null, [{ address: "8.8.8.8", family: 4 }]]);
    lookup("www.g2b.go.kr", { all: false }, (...args) => {
      lookupResult = args;
    });
    expect(lookupResult).toEqual([null, "8.8.8.8", 4]);
  });

  it.each([204, 205, 304])(
    "maps body-forbidden HTTPS status %s to a stable error without escaping the callback",
    async (statusCode) => {
      let onResponse: ((incoming: IncomingMessage) => void) | undefined;
      let markTransportReady: (() => void) | undefined;
      const transportReady = new Promise<void>((resolve) => {
        markTransportReady = resolve;
      });
      const request = new EventEmitter() as MockClientRequest;
      request.end = () => undefined;
      httpsRequestMock.mockImplementationOnce(((
        _url: URL,
        _options: Record<string, unknown>,
        callback: (incoming: IncomingMessage) => void,
      ) => {
        onResponse = callback;
        markTransportReady?.();
        return request;
      }) as never);
      const fetcher = new TenderDocumentFetcher({
        resolveHost: async () => ["8.8.8.8"],
      });

      const rejected = fetcher
        .fetch(document(), new AbortController().signal)
        .catch((error) => error);
      await transportReady;
      let escaped: unknown;
      try {
        onResponse?.(incomingResponse(statusCode));
      } catch (error) {
        escaped = error;
      } finally {
        request.emit("error", new Error("settle transport probe"));
      }

      await expect(rejected).resolves.toMatchObject({
        code: "DOCUMENT_NETWORK_ERROR",
      });
      expect(escaped).toBeUndefined();
    },
  );

  it("streams a validated official document and returns only bytes, detected format, and sha256", async () => {
    const result = await createFetcher().fetch(
      document(),
      new AbortController().signal,
    );

    expect(Buffer.from(result.bytes)).toEqual(pdfBytes);
    expect(result.detectedFormat).toBe("PDF");
    expect(result.sha256).toBe(
      "f581fc87f30296eff11777c3ce1b9a8b7077071ad8abedfcba317fef0c807224",
    );
    expect(Object.keys(result).sort()).toEqual([
      "bytes",
      "detectedFormat",
      "sha256",
    ]);
  });

  it("POSTs the exact LH form body after validating issued query metadata", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const zipBytes = createStoredZip(["readme.txt"]);
    const fetcher = new TenderDocumentFetcher({
      resolveHost: async () => ["8.8.8.8"],
      fetcher: async (url, init) => {
        requestedUrl = url;
        requestedInit = init;
        return new Response(zipBytes, {
          status: 200,
          headers: { "content-type": "application/zip" },
        });
      },
    });

    await expect(
      fetcher.fetch(lhDocument(), new AbortController().signal),
    ).resolves.toMatchObject({ detectedFormat: "ZIP" });
    expect(requestedUrl).toBe(
      "https://ebid.lh.or.kr/ebid.framework.download.dev",
    );
    expect(requestedInit).toMatchObject({
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: "download.filespec=bidinfo&download.filename=%EA%B3%B5%EA%B3%A0%EB%AC%B8.zip&download.savedname=20260901_notice.zip&download.bidnum=",
    });
  });

  it.each([
    ["host", { url: lhDocument().url.replace("ebid.lh.or.kr", "evil.example") }],
    ["path", { url: lhDocument().url.replace("download.dev", "download2.dev") }],
    ["identity", { identity: "LH:2603251:00:11" }],
    ["evidence", { evidence: { source: "LH_PAGE", operation: "LH_NOTICE_DOCUMENTS", field: "attachment:11" } }],
    ["display name", { displayName: "다른파일.zip" }],
    ["format hint", { formatHint: "PDF" }],
    [
      "unsafe display metadata",
      (() => {
        const url = new URL(lhDocument().url);
        url.searchParams.set("displayName", "bad\r\nname.zip");
        return { url: url.toString(), displayName: "bad\r\nname.zip" };
      })(),
    ],
    ["query key", { url: `${lhDocument().url}&method=GET` }],
    ["duplicate query", { url: `${lhDocument().url}&sequence=10` }],
  ] as const)("rejects an LH reference with mismatched %s before transport", async (_label, overrides) => {
    const transport = jest.fn();
    const fetcher = new TenderDocumentFetcher({
      resolveHost: async () => ["8.8.8.8"],
      fetcher: transport,
    });

    await expect(
      fetcher.fetch(
        lhDocument(overrides as Partial<TenderDocumentReference>),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects a method-changing LH redirect without replaying the request", async () => {
    const transport = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: lhDocument().url } }),
      );
    const fetcher = new TenderDocumentFetcher({
      resolveHost: async () => ["8.8.8.8"],
      fetcher: transport,
    });

    await expect(
      fetcher.fetch(lhDocument(), new AbortController().signal),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["HTTP", "http://www.g2b.go.kr/document.pdf"],
    ["credentials", "https://user:password@www.g2b.go.kr/document.pdf"],
    ["an off-allowlist host", "https://evil.example/document.pdf"],
  ])("rejects %s before network access", async (_label, url) => {
    await expect(
      createFetcher().fetch(document({ url }), new AbortController().signal),
    ).rejects.toMatchObject({
      code: "DOCUMENT_OFF_ALLOWLIST",
    });
  });

  it("rejects a URL whose host does not match the producing adapter", async () => {
    await expect(
      createFetcher().fetch(
        document({
          source: "KAPT_PAGE",
          url: "https://www.g2b.go.kr/document.pdf",
        }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it.each([
    ["a missing notice binding", "https://www.g2b.go.kr/document.pdf"],
    [
      "a mismatched revision",
      "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01000001&bidPbancOrd=999&fileType=&fileSeq=1&prcmBsneSeCd=01",
    ],
    [
      "a manufactured official-host path",
      "https://www.g2b.go.kr/manufactured.pdf?bidPbancNo=R26BK01000001&bidPbancOrd=000&fileType=&fileSeq=1&prcmBsneSeCd=01",
    ],
    [
      "the obsolete synthetic attachment path",
      "https://www.g2b.go.kr/pt/file/download.do?bidNtceNo=R26BK01000001&bidNtceOrd=000&fileSeq=1",
    ],
    ["an unexpected query key", `${g2bDocumentUrl("document")}&token=secret`],
  ])(
    "rejects %s even when its reference metadata looks valid",
    async (_label, url) => {
      await expect(
        createFetcher().fetch(document({ url }), new AbortController().signal),
      ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
    },
  );

  it("rejects an issued URL rebound to a different evidence slot", async () => {
    await expect(
      createFetcher().fetch(
        document({
          identity: "G2B:R26BK01000001:000:2",
          evidence: {
            source: "G2B_API",
            operation: "getBidPblancListInfoThng",
            field: "ntceSpecDocUrl2",
          },
        }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it("rejects a cloned document reference that was not issued by an adapter", async () => {
    const manufactured = { ...document() };

    await expect(
      createFetcher().fetch(manufactured, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it("rejects manufactured K-apt metadata even with a canonical-looking URL", async () => {
    const manufactured: TenderDocumentReference = {
      identity: "KAPT:202609060001:1:1",
      url: "https://www.k-apt.go.kr/bid/fileDownload.do?bidNum=202609060001&fileSeq=1",
      displayName: "공고문.pdf",
      formatHint: "PDF",
      source: "KAPT_PAGE",
      sourceNoticeId: "202609060001",
      revision: "1",
      evidence: {
        source: "KAPT_PAGE",
        operation: "KAPT_NOTICE_DOCUMENTS",
        field: "attachment:1",
      },
    };

    await expect(
      createFetcher().fetch(manufactured, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it.each([
    "127.0.0.1",
    "10.0.0.2",
    "169.254.169.254",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "fc00::1",
    "2001:db8::1",
  ])("rejects private or reserved DNS result %s", async (address) => {
    await expect(
      createFetcher({ addresses: [address] }).fetch(
        document(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it("rejects the entire DNS answer when any address is not public", async () => {
    await expect(
      createFetcher({ addresses: ["8.8.8.8", "127.0.0.1"] }).fetch(
        document(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it("validates every manual redirect before following it", async () => {
    await expect(
      createFetcher().fetch(
        document({ url: g2bDocumentUrl("offsite") }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it("stops the response stream at 20 MiB plus one byte", async () => {
    await expect(
      createFetcher().fetch(
        document({ url: g2bDocumentUrl("oversized") }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_TOO_LARGE" });
  });

  it("rejects MIME, magic-byte, and declared-format disagreement", async () => {
    await expect(
      createFetcher().fetch(
        document({ url: g2bDocumentUrl("mismatch") }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_FORMAT_MISMATCH" });
  });

  const fetchStaticDocument = (
    bytes: Uint8Array,
    formatHint: TenderDocumentReference["formatHint"],
    contentType: string,
  ) =>
    new TenderDocumentFetcher({
      resolveHost: async () => ["8.8.8.8"],
      fetcher: async () =>
        new Response(bytes, {
          status: 200,
          headers: { "content-type": contentType },
        }),
    }).fetch(
      document({ formatHint, displayName: `fixture.${formatHint}` }),
      new AbortController().signal,
    );

  it.each([
    ["signature-only OLE", hwpBytes, "HWP" as const, "application/x-hwp"],
    [
      "marker-only ZIP",
      Buffer.from("PK\u0003\u0004word/document.xml", "latin1"),
      "DOCX" as const,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "truncated HWP FileHeader stream",
      createTruncatedHwpCompoundFile(),
      "HWP" as const,
      "application/x-hwp",
    ],
  ])("rejects a corrupt %s container", async (_label, bytes, hint, mime) => {
    await expect(fetchStaticDocument(bytes, hint, mime)).rejects.toMatchObject({
      code: "DOCUMENT_FORMAT_MISMATCH",
    });
  });

  const docxEntries = ["[Content_Types].xml", "word/document.xml"];
  it.each([
    [0x0002, "maximum"],
    [0x0004, "fast"],
    [0x0006, "super-fast"],
  ])(
    "accepts nonempty Deflate entries using flag value %s for %s compression",
    async (flags) => {
      await expect(
        fetchStaticDocument(
          createDeflatedZip(docxEntries, flags),
          "DOCX",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ).resolves.toMatchObject({ detectedFormat: "DOCX" });
    },
  );

  it.each([
    [0x0001, "encryption"],
    [0x0020, "patched-data"],
  ])("rejects Deflate entries using the unsupported %s flag", async (flags) => {
    await expect(
      fetchStaticDocument(
        createDeflatedZip(docxEntries, flags),
        "DOCX",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_FORMAT_MISMATCH" });
  });

  it("rejects Deflate option bits on a stored entry", async () => {
    const bytes = mutateZip(createStoredZip(docxEntries), (zip) => {
      zip.writeUInt16LE(0x0002, 6);
      zip.writeUInt16LE(0x0002, centralOffset(zip) + 8);
    });

    await expect(
      fetchStaticDocument(
        bytes,
        "DOCX",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_FORMAT_MISMATCH" });
  });

  it.each([
    ["truncated end record", createStoredZip(docxEntries).subarray(0, -1)],
    [
      "contradictory local compressed size",
      mutateZip(createStoredZip(docxEntries), (zip) =>
        zip.writeUInt32LE(0x7fffffff, 18),
      ),
    ],
    [
      "contradictory local compression method",
      mutateZip(createStoredZip(docxEntries), (zip) => zip.writeUInt16LE(8, 8)),
    ],
    [
      "contradictory local flags",
      mutateZip(createStoredZip(docxEntries), (zip) =>
        zip.writeUInt16LE(0x0008, 6),
      ),
    ],
    [
      "ZIP64 sentinel metadata",
      mutateZip(createStoredZip(docxEntries), (zip) =>
        zip.writeUInt32LE(0xffffffff, centralOffset(zip) + 24),
      ),
    ],
    [
      "compressed data extent overlapping the next local header",
      mutateZip(createStoredZip(docxEntries), (zip) => {
        zip.writeUInt32LE(10, 18);
        zip.writeUInt32LE(10, 22);
        zip.writeUInt32LE(10, centralOffset(zip) + 20);
        zip.writeUInt32LE(10, centralOffset(zip) + 24);
      }),
    ],
    [
      "contradictory data descriptor sizes",
      mutateZip(
        createStoredZip(docxEntries, { dataDescriptors: true }),
        (zip) => zip.writeUInt32LE(1, firstLocalDataOffset(zip) + 8),
      ),
    ],
  ])("rejects ZIP container with %s", async (_label, bytes) => {
    await expect(
      fetchStaticDocument(
        bytes,
        "DOCX",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_FORMAT_MISMATCH" });
  });

  it("accepts a valid ZIP data descriptor layout without decompressing entries", async () => {
    await expect(
      fetchStaticDocument(
        createStoredZip(docxEntries, { dataDescriptors: true }),
        "DOCX",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).resolves.toMatchObject({ detectedFormat: "DOCX" });
  });

  it.each([
    ["HWP", createHwpCompoundFile(), "application/x-hwp"],
    [
      "HWPX",
      createStoredZip([
        "mimetype",
        "META-INF/container.xml",
        "Contents/content.hpf",
        "Contents/section0.xml",
      ]),
      "application/hwp+zip",
    ],
    [
      "DOCX",
      createStoredZip(["[Content_Types].xml", "word/document.xml"]),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "XLSX",
      createStoredZip(["[Content_Types].xml", "xl/workbook.xml"]),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  ] as const)(
    "accepts a structurally valid representative %s container",
    async (format, bytes, mime) => {
      await expect(
        fetchStaticDocument(bytes, format, mime),
      ).resolves.toMatchObject({
        detectedFormat: format,
      });
    },
  );

  it("aborts the entire fetch boundary on timeout", async () => {
    await expect(
      createFetcher({ timeoutMs: 30 }).fetch(
        document({ url: g2bDocumentUrl("slow") }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_TIMEOUT" });
  });

  it("applies the same timeout while DNS resolution is pending", async () => {
    const startedAt = Date.now();
    const fetcher = new TenderDocumentFetcher({
      timeoutMs: 30,
      resolveHost: () =>
        new Promise((resolve) => setTimeout(() => resolve(["8.8.8.8"]), 250)),
      fetcher: () => Promise.reject(new Error("must not reach transport")),
    });

    await expect(
      fetcher.fetch(document(), new AbortController().signal),
    ).rejects.toMatchObject({ code: "DOCUMENT_TIMEOUT" });
    expect(Date.now() - startedAt).toBeLessThan(150);
  });

  it("rejects excessive redirect count", async () => {
    await expect(
      createFetcher().fetch(
        document({ url: g2bDocumentUrl("redirect") }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_REDIRECT_LIMIT" });
  });

  it("sanitizes errors so URLs, credentials, and response content are not enumerable", async () => {
    const pending = createFetcher().fetch(
      document({
        url: "https://user:secret@www.g2b.go.kr/private.pdf?token=secret",
      }),
      new AbortController().signal,
    );
    const error = await pending.catch(
      (reason) => reason as TenderDocumentFetchError,
    );

    expect(JSON.stringify(error)).not.toContain("secret");
    expect(Object.keys(error)).toEqual(["code"]);
  });
});

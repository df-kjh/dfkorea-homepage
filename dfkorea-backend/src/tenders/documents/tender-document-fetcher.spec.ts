import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import {
  TenderDocumentFetchError,
  TenderDocumentFetcher,
} from "./tender-document-fetcher";
import { TenderDocumentReference } from "../domain/tender-enrichment";

const pdfBytes = Buffer.from("%PDF-1.7\nfixture");
const hwpBytes = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00,
]);

const document = (
  overrides: Partial<TenderDocumentReference> = {},
): TenderDocumentReference => ({
  identity: "G2B:R26BK01000001:000:1",
  url: "https://www.g2b.go.kr/document.pdf",
  displayName: "규격서.pdf",
  formatHint: "PDF",
  source: "G2B_API",
  sourceNoticeId: "R26BK01000001",
  revision: "000",
  evidence: {
    source: "G2B_API",
    operation: "getBidPblancListInfoThng",
    field: "ntceSpecDocUrl1",
  },
  ...overrides,
});

describe("TenderDocumentFetcher", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url || "/", "http://local.test");
      if (url.pathname === "/document.pdf") {
        response.writeHead(200, { "content-type": "application/pdf" });
        response.end(pdfBytes);
        return;
      }
      if (url.pathname === "/oversized.pdf") {
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
      if (url.pathname === "/mismatch.pdf") {
        response.writeHead(200, { "content-type": "application/pdf" });
        response.end(hwpBytes);
        return;
      }
      if (url.pathname === "/slow.pdf") {
        setTimeout(() => {
          if (!response.destroyed) {
            response.writeHead(200, { "content-type": "application/pdf" });
            response.end(pdfBytes);
          }
        }, 250);
        return;
      }
      if (url.pathname === "/offsite.pdf") {
        response.writeHead(302, {
          location: "https://evil.example/document.pdf",
        });
        response.end();
        return;
      }
      if (url.pathname === "/redirect.pdf") {
        const count = Number(url.searchParams.get("count") || "0");
        response.writeHead(302, {
          location:
            count >= 5
              ? "https://www.g2b.go.kr/document.pdf"
              : `https://www.g2b.go.kr/redirect.pdf?count=${count + 1}`,
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
        document({ url: "https://www.g2b.go.kr/offsite.pdf" }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_OFF_ALLOWLIST" });
  });

  it("stops the response stream at 20 MiB plus one byte", async () => {
    await expect(
      createFetcher().fetch(
        document({ url: "https://www.g2b.go.kr/oversized.pdf" }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_TOO_LARGE" });
  });

  it("rejects MIME, magic-byte, and declared-format disagreement", async () => {
    await expect(
      createFetcher().fetch(
        document({ url: "https://www.g2b.go.kr/mismatch.pdf" }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_FORMAT_MISMATCH" });
  });

  it("aborts the entire fetch boundary on timeout", async () => {
    await expect(
      createFetcher({ timeoutMs: 30 }).fetch(
        document({ url: "https://www.g2b.go.kr/slow.pdf" }),
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
        document({ url: "https://www.g2b.go.kr/redirect.pdf?count=0" }),
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

import * as JSZip from "jszip";
import * as CFB from "cfb";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TenderDocumentTextExtractor } from "./tender-document-extractor";
import { TenderDocumentFormat } from "../domain/tender-enrichment";

const fixture = (name: string, detectedFormat?: TenderDocumentFormat) => ({
  bytes: readFileSync(join(__dirname, "fixtures", name)),
  detectedFormat:
    detectedFormat ??
    (name.split(".").pop()!.toUpperCase() as TenderDocumentFormat),
});
const paragraphs = [
  "소비전력 50W 이하",
  "광효율 130 lm/W 이상",
  "고효율 인증 필수",
];
const rows = [
  ["항목", "기준"],
  ["소비전력", "50W 이하"],
  ["광효율", "130 lm/W 이상"],
];

describe("TenderDocumentTextExtractor", () => {
  jest.setTimeout(30_000);
  const extractor = new TenderDocumentTextExtractor();
  it.each([
    "sample.hwp",
    "sample.hwpx",
    "sample.pdf",
    "sample.docx",
    "sample.xlsx",
  ])(
    "preserves literal requirements and two-column table order in %s",
    async (name) => {
      const result = await extractor.extract(fixture(name));
      expect(result.status).toBe("EXTRACTED");
      expect(
        result.blocks.map((block) =>
          block.kind === "text" ? block.text : block.rows,
        ),
      ).toEqual([...paragraphs, rows]);
      expect(result.blocks.map((block) => block.ordinal)).toEqual([0, 1, 2, 3]);
      expect(result.blocks.map((block) => block.location)).toEqual(
        name.endsWith("xlsx")
          ? [
              "sheet:요구사항/row:1",
              "sheet:요구사항/row:2",
              "sheet:요구사항/row:3",
              "sheet:요구사항/rows:5-7",
            ]
          : name.endsWith("pdf")
            ? [
                "page:1/paragraph:1",
                "page:1/paragraph:2",
                "page:1/paragraph:3",
                "page:1/table:1",
              ]
            : name.endsWith("docx")
              ? [
                  "body/paragraph:1",
                  "body/paragraph:2",
                  "body/paragraph:3",
                  "body/table:1",
                ]
              : [
                  "section:1/paragraph:1",
                  "section:1/paragraph:2",
                  "section:1/paragraph:3",
                  "section:1/table:1",
                ],
      );
    },
  );
  it.each([
    "review-footnote.docx",
    "review-endnote.docx",
    "review-nested-image.docx",
  ])("marks omitted nested DOCX content partial in %s", async (name) => {
    const result = await extractor.extract(fixture(name));
    expect(result.status).toBe("PARTIAL");
    expect(result.blocks[0]).toMatchObject({
      kind: "text",
      text: "소비전력 50W 이하",
    });
  });
  it("preserves DOCX tab word boundaries in paragraphs and table cells", async () => {
    const result = await extractor.extract(fixture("review-tabs.docx"));
    expect(result.status).toBe("EXTRACTED");
    expect(
      result.blocks.map((block) =>
        block.kind === "text" ? block.text : block.rows,
      ),
    ).toEqual(["소비전력 50W 이하", [["항목", "광효율 130 lm/W 이상"]]]);
  });
  it("preserves HWP text on both sides of an inline table anchor", async () => {
    const result = await extractor.extract(fixture("inline.hwp"));
    expect(result.status).toBe("EXTRACTED");
    expect(
      result.blocks.map((block) =>
        block.kind === "text" ? block.text : block.rows,
      ),
    ).toEqual([
      "소비전력 50W 이하",
      "광효율 130 lm/W 이상",
      "고효율 인증 필수",
      "표 앞 조건",
      [
        ["항목", "기준"],
        ["소비전력", "50W 이하"],
        ["광효율", "130 lm/W 이상"],
      ],
      "표 뒤 조건",
    ]);
  });
  it("preserves serial date time and boolean display in a 1904-date workbook", async () => {
    const result = await extractor.extract(fixture("dates-1904.xlsx"));
    expect(result.blocks).toEqual([
      {
        kind: "table",
        ordinal: 0,
        location: "sheet:날짜/rows:1-2",
        rows: [
          ["날짜", "적용"],
          ["2026-09-06 00:00", "TRUE"],
        ],
      },
    ]);
  });
  it("separates multiple paragraphs inside one HWPX table cell", async () => {
    const zip = await JSZip.loadAsync(fixture("sample.hwpx").bytes);
    const xml = await zip.file("Contents/section0.xml")!.async("string");
    zip.file(
      "Contents/section0.xml",
      xml.replace(
        "</hp:subList>",
        "<hp:p><hp:run><hp:t>세부 기준</hp:t></hp:run></hp:p></hp:subList>",
      ),
    );
    const result = await extractor.extract({
      bytes: await zip.generateAsync({ type: "uint8array" }),
      detectedFormat: "HWPX",
    });
    expect(result.blocks[3]).toMatchObject({
      kind: "table",
      rows: [
        ["항목 세부 기준", "기준"],
        ["소비전력", "50W 이하"],
        ["광효율", "130 lm/W 이상"],
      ],
    });
  });
  it("rejects a high-ratio compressed HWP body before parser inflation", async () => {
    const cfb = CFB.read(fixture("sample.hwp").bytes, { type: "buffer" });
    CFB.utils.cfb_add(
      cfb,
      "/BodyText/Section0",
      deflateRawSync(Buffer.alloc(11 * 1024 * 1024, 65)),
    );
    await expect(
      extractor.extract({
        bytes: CFB.write(cfb, { type: "buffer" }),
        detectedFormat: "HWP",
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_ARCHIVE_LIMIT" });
  });
  it("rejects truncated HWP records inside an otherwise valid CFB", async () => {
    const cfb = CFB.read(fixture("sample.hwp").bytes, { type: "buffer" });
    CFB.utils.cfb_add(
      cfb,
      "/BodyText/Section0",
      deflateRawSync(Buffer.from([66, 0, 240, 255])),
    );
    await expect(
      extractor.extract({
        bytes: CFB.write(cfb, { type: "buffer" }),
        detectedFormat: "HWP",
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_CORRUPT" });
  });
  it.each(["<w:p>", '<!DOCTYPE x [<!ENTITY a "expanded">]><w:p>&a;</w:p>'])(
    "rejects malformed XML/entity definitions without exposing parser errors",
    async (xml) => {
      const zip = await JSZip.loadAsync(fixture("sample.docx").bytes);
      zip.file("word/document.xml", xml);
      await expect(
        extractor.extract({
          bytes: await zip.generateAsync({ type: "uint8array" }),
          detectedFormat: "DOCX",
        }),
      ).rejects.toMatchObject({
        code: "DOCUMENT_CORRUPT",
        message: "DOCUMENT_CORRUPT",
      });
    },
  );
  it("records hidden worksheets and displayed numeric/formula values", async () => {
    const result = await extractor.extract(fixture("formatted.xlsx"));
    expect(result.metadata).toEqual({
      sheets: ["가격", "숨김"],
      hiddenSheets: ["숨김"],
    });
    expect(
      result.blocks.map((block) =>
        block.kind === "text" ? block.text : block.rows,
      ),
    ).toEqual([
      [
        ["금액", "비율"],
        ["1,234.50", "25%"],
        ["2,469.00", "2026-09-06"],
      ],
      "고효율 인증 필수",
    ]);
  });
  it.each(["encrypted.hwp", "encrypted.pdf"])(
    "normalizes encrypted %s",
    async (name) => {
      await expect(extractor.extract(fixture(name))).rejects.toMatchObject({
        code: "DOCUMENT_ENCRYPTED",
        status: "FAILED",
      });
    },
  );
  it.each([
    "corrupt.hwp",
    "corrupt.hwpx",
    "corrupt.pdf",
    "corrupt.docx",
    "corrupt.xlsx",
  ])("normalizes corrupt %s", async (name) => {
    await expect(extractor.extract(fixture(name))).rejects.toMatchObject({
      code: "DOCUMENT_CORRUPT",
      status: "FAILED",
    });
  });
  it("does not claim image-only PDF was extracted", async () => {
    await expect(
      extractor.extract(fixture("image-only.pdf")),
    ).rejects.toMatchObject({
      code: "DOCUMENT_OCR_REQUIRED",
      status: "UNSUPPORTED",
    });
  });
  it("preserves text from mixed text/image pages as a partial result", async () => {
    const result = await extractor.extract(fixture("partial.pdf"));
    expect(result.status).toBe("PARTIAL");
    expect(result.metadata.pages).toBe(2);
    expect(result.blocks[0]).toMatchObject({
      kind: "text",
      text: "소비전력 50W 이하",
      location: "page:1/paragraph:1",
    });
  });
  it.each([
    ["text-limit.docx", "DOCUMENT_TEXT_LIMIT"],
    ["entry-limit.docx", "DOCUMENT_ARCHIVE_LIMIT"],
    ["ratio-limit.docx", "DOCUMENT_ARCHIVE_LIMIT"],
    ["ratio-limit.pdf", "DOCUMENT_ARCHIVE_LIMIT"],
    ["lying-size.docx", "DOCUMENT_CORRUPT"],
    ["distributed.hwp", "DOCUMENT_UNSUPPORTED"],
    ["old-version.hwp", "DOCUMENT_UNSUPPORTED"],
  ])("normalizes bounded failure for %s", async (name, code) => {
    await expect(extractor.extract(fixture(name))).rejects.toMatchObject({
      code,
    });
  });
  it("terminates parsing at a hard deadline", async () => {
    await expect(
      new TenderDocumentTextExtractor({ timeoutMs: 1 }).extract(
        fixture("sample.pdf"),
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_TIMEOUT", status: "FAILED" });
    await expect(
      extractor.extract(fixture("sample.docx")),
    ).resolves.toMatchObject({ status: "EXTRACTED" });
  });
  it("rejects oversized input before starting a parser", async () => {
    await expect(
      extractor.extract({
        bytes: new Uint8Array(20 * 1024 * 1024 + 1),
        detectedFormat: "PDF",
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_TOO_LARGE" });
  });
});

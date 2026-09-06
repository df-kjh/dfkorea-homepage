import {
  ExtractedDocument,
  MAX_TEXT_BYTES,
  TenderDocumentExtractionError,
} from "../tender-document-extraction.types";

export const normalizeText = (text: string) =>
  text.replace(/[\t\r\n\u00a0 ]+/g, " ").trim();
export class ExtractionContext {
  readonly result: ExtractedDocument = {
    status: "EXTRACTED",
    blocks: [],
    metadata: {},
  };
  private textBytes = 0;
  private cells = 0;
  count(text: string): void {
    this.textBytes += Buffer.byteLength(text, "utf8");
    if (this.textBytes > MAX_TEXT_BYTES)
      throw new TenderDocumentExtractionError("DOCUMENT_TEXT_LIMIT");
  }
  text(text: string, location: string): void {
    this.count(text);
    const normalized = normalizeText(text);
    if (normalized)
      this.result.blocks.push({
        kind: "text",
        ordinal: this.result.blocks.length,
        location,
        text: normalized,
      });
    this.checkBlocks();
  }
  table(rows: string[][], location: string): void {
    for (const row of rows)
      for (const cell of row) {
        this.count(cell);
        this.cells++;
      }
    if (this.cells > 100_000)
      throw new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");
    this.result.blocks.push({
      kind: "table",
      ordinal: this.result.blocks.length,
      location,
      rows: rows.map((row) => row.map(normalizeText)),
    });
    this.checkBlocks();
  }
  partial(): void {
    this.result.status = "PARTIAL";
  }
  private checkBlocks(): void {
    if (this.result.blocks.length > 100_000)
      throw new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");
  }
}
// Preserve native import under CommonJS compilation. hwp-convert exposes only
// an ESM import entry; PDF.js's supported Node build is an ESM module as well.
export const importEsm = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<any>;

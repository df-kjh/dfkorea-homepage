import { TenderDocumentFormat } from "../domain/tender-enrichment";

export interface TextBlock {
  kind: "text";
  ordinal: number;
  location: string;
  text: string;
}
export interface TableBlock {
  kind: "table";
  ordinal: number;
  location: string;
  rows: string[][];
}
export interface ExtractedDocument {
  status: "EXTRACTED" | "PARTIAL";
  blocks: Array<TextBlock | TableBlock>;
  metadata: { pages?: number; sheets?: string[]; hiddenSheets?: string[] };
}
export interface ExtractionInput {
  bytes: Uint8Array;
  detectedFormat: TenderDocumentFormat;
}
export type ExtractionErrorCode =
  | "DOCUMENT_ENCRYPTED"
  | "DOCUMENT_UNSUPPORTED"
  | "DOCUMENT_CORRUPT"
  | "DOCUMENT_OCR_REQUIRED"
  | "DOCUMENT_TIMEOUT"
  | "DOCUMENT_TEXT_LIMIT"
  | "DOCUMENT_ARCHIVE_LIMIT"
  | "DOCUMENT_TOO_LARGE";
export class TenderDocumentExtractionError extends Error {
  readonly status: "FAILED" | "UNSUPPORTED";
  constructor(readonly code: ExtractionErrorCode) {
    super(code);
    this.name = "TenderDocumentExtractionError";
    this.status =
      code === "DOCUMENT_UNSUPPORTED" || code === "DOCUMENT_OCR_REQUIRED"
        ? "UNSUPPORTED"
        : "FAILED";
  }
}
export const MAX_TEXT_BYTES = 10 * 1024 * 1024;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

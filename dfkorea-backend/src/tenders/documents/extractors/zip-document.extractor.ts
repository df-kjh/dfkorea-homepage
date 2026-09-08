import { TenderDocumentFormat } from "../../domain/tender-enrichment";
import { TenderDocumentExtractionError } from "../tender-document-extraction.types";
import { readBoundedZip } from "./archive-guard";
import { DocxDocumentExtractor } from "./docx-document.extractor";
import { ExtractionContext } from "./extraction-context";
import { HwpDocumentExtractor } from "./hwp-document.extractor";
import { PdfDocumentExtractor } from "./pdf-document.extractor";
import { XlsxDocumentExtractor } from "./xlsx-document.extractor";

type ChildFormat = Exclude<TenderDocumentFormat, "ZIP">;

export class ZipDocumentExtractor {
  async extract(
    _bytes: Buffer,
    context: ExtractionContext,
    archive: Map<string, Buffer>,
  ): Promise<void> {
    let supportedMembers = 0;
    let unsupportedMembers = 0;
    for (const [name, contents] of archive) {
      if (name.endsWith("/")) continue;
      const detected = this.detect(contents);
      if (detected === "ZIP") {
        // Package formats are consumed as documents below. A generic ZIP inside
        // this outer bundle would require recursive archive expansion.
        throw new TenderDocumentExtractionError("DOCUMENT_UNSUPPORTED");
      }
      if (detected === null) {
        unsupportedMembers += 1;
        continue;
      }

      supportedMembers += 1;
      const child = new ExtractionContext();
      await this.extractChild(detected, contents, child);
      if (!child.result.blocks.length) {
        throw new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
      }
      for (const block of child.result.blocks) {
        const location = `${name}::${block.location}`;
        if (block.kind === "text") context.text(block.text, location);
        else context.table(block.rows, location);
      }
      this.mergeMetadata(name, child, context);
      if (child.result.status === "PARTIAL") context.partial();
    }

    if (supportedMembers === 0) {
      throw new TenderDocumentExtractionError("DOCUMENT_UNSUPPORTED");
    }
    if (unsupportedMembers > 0) context.partial();
  }

  private detect(bytes: Buffer): ChildFormat | "ZIP" | null {
    if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "PDF";
    if (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      )
    ) {
      return "HWP";
    }
    if (
      bytes.length < 4 ||
      !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    ) {
      return null;
    }
    const entries = readBoundedZip(bytes);
    if (
      entries.has("META-INF/container.xml") &&
      entries.has("Contents/content.hpf") &&
      [...entries.keys()].some((entry) =>
        /^Contents\/section\d+\.xml$/.test(entry),
      )
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

  private async extractChild(
    format: ChildFormat,
    bytes: Buffer,
    context: ExtractionContext,
  ): Promise<void> {
    switch (format) {
      case "HWP":
        await new HwpDocumentExtractor().extract(bytes, context);
        return;
      case "HWPX":
        await new HwpDocumentExtractor().extract(
          bytes,
          context,
          readBoundedZip(bytes),
        );
        return;
      case "PDF":
        await new PdfDocumentExtractor().extract(bytes, context);
        return;
      case "DOCX":
        await new DocxDocumentExtractor().extract(
          bytes,
          context,
          readBoundedZip(bytes),
        );
        return;
      case "XLSX":
        await new XlsxDocumentExtractor().extract(
          bytes,
          context,
          readBoundedZip(bytes),
        );
    }
  }

  private mergeMetadata(
    name: string,
    child: ExtractionContext,
    context: ExtractionContext,
  ): void {
    const metadata = child.result.metadata;
    if (metadata.pages !== undefined) {
      context.result.metadata.pages =
        (context.result.metadata.pages ?? 0) + metadata.pages;
    }
    if (metadata.sheets) {
      context.result.metadata.sheets = [
        ...(context.result.metadata.sheets ?? []),
        ...metadata.sheets.map((sheet) => `${name}::${sheet}`),
      ];
    }
    if (metadata.hiddenSheets) {
      context.result.metadata.hiddenSheets = [
        ...(context.result.metadata.hiddenSheets ?? []),
        ...metadata.hiddenSheets.map((sheet) => `${name}::${sheet}`),
      ];
    }
  }
}

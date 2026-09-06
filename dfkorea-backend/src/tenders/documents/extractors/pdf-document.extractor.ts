import { guardPdfStreams } from "./pdf-stream-guard";
import {
  MAX_TEXT_BYTES,
  TenderDocumentExtractionError,
} from "../tender-document-extraction.types";
import {
  ExtractionContext,
  importEsm,
  normalizeText,
} from "./extraction-context";
interface Item {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
}
export class PdfDocumentExtractor {
  async extract(bytes: Buffer, context: ExtractionContext): Promise<void> {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
    guardPdfStreams(bytes);
    const pdf = await importEsm("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdf.getDocument({
      data: Uint8Array.from(bytes),
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      disableAutoFetch: true,
      disableStream: true,
      verbosity: 0,
      maxImageSize: 0,
      stopAtErrors: true,
    });
    try {
      const document = await task.promise;
      context.result.metadata.pages = document.numPages;
      if (document.numPages > 2000)
        throw new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");
      let emptyPages = 0;
      let decodedTextBytes = 0;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber),
          reader = page
            .streamTextContent({ disableNormalization: false })
            .getReader();
        const items: Item[] = [];
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            for (const item of chunk.value.items) {
              if (typeof item.str !== "string") continue;
              decodedTextBytes += Buffer.byteLength(item.str, "utf8");
              if (decodedTextBytes > MAX_TEXT_BYTES)
                throw new TenderDocumentExtractionError("DOCUMENT_TEXT_LIMIT");
              if (item.str.trim()) items.push(item);
              if (items.length > 100_000)
                throw new TenderDocumentExtractionError(
                  "DOCUMENT_ARCHIVE_LIMIT",
                );
            }
          }
        } finally {
          reader.releaseLock();
        }
        if (!items.length) {
          emptyPages++;
          page.cleanup();
          continue;
        }
        const lines: Array<{ y: number; items: Item[] }> = [];
        // PDF has positioned glyphs rather than table semantics. Group baselines
        // and require repeated aligned cell starts before classifying a table.
        for (const item of items.sort(
          (a, b) =>
            b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
        )) {
          const last = lines[lines.length - 1];
          if (last && Math.abs(last.y - item.transform[5]) < 2)
            last.items.push(item);
          else lines.push({ y: item.transform[5], items: [item] });
        }
        const split = (line: { items: Item[] }) => {
          const cells: Array<{ x: number; text: string }> = [];
          let previous: Item | undefined;
          for (const item of line.items) {
            const gap = previous
              ? item.transform[4] - previous.transform[4] - previous.width
              : Infinity;
            if (!previous || gap > Math.max(15, item.height * 1.5))
              cells.push({ x: item.transform[4], text: item.str });
            else
              cells[cells.length - 1].text += (gap > 1 ? " " : "") + item.str;
            previous = item;
          }
          return cells;
        };
        const cellLines = lines.map(split);
        let paragraph = 0,
          table = 0;
        for (let index = 0; index < cellLines.length; ) {
          const current = cellLines[index];
          let end = index + 1;
          if (current.length > 1)
            while (
              end < cellLines.length &&
              cellLines[end].length === current.length &&
              cellLines[end].every(
                (cell, i) => Math.abs(cell.x - current[i].x) < 5,
              ) &&
              lines[end - 1].y - lines[end].y < 50
            )
              end++;
          if (end - index >= 2) {
            context.table(
              cellLines
                .slice(index, end)
                .map((row) => row.map((cell) => cell.text)),
              `page:${pageNumber}/table:${++table}`,
            );
            index = end;
          } else {
            context.text(
              current.map((cell) => normalizeText(cell.text)).join(" | "),
              `page:${pageNumber}/paragraph:${++paragraph}`,
            );
            index++;
          }
        }
        page.cleanup();
      }
      if (emptyPages === document.numPages)
        throw new TenderDocumentExtractionError("DOCUMENT_OCR_REQUIRED");
      if (emptyPages) context.partial();
    } catch (error) {
      if (error.name === "PasswordException")
        throw new TenderDocumentExtractionError("DOCUMENT_ENCRYPTED");
      throw error;
    } finally {
      await task.destroy();
    }
  }
}

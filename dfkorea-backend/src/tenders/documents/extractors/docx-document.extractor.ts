import * as mammoth from "mammoth";
import { TenderDocumentExtractionError } from "../tender-document-extraction.types";
import { ExtractionContext } from "./extraction-context";
interface Element {
  type: string;
  value?: string;
  children?: Element[];
  colSpan?: number;
  rowSpan?: number;
}
const plainText = (element: Element): string =>
  element.type === "text"
    ? (element.value ?? "")
    : element.type === "tab"
      ? "\t"
      : element.type === "break"
        ? "\n"
        : (element.children ?? [])
            .map(plainText)
            .join(element.type === "tableCell" ? "\n" : "");
export class DocxDocumentExtractor {
  async extract(
    bytes: Buffer,
    context: ExtractionContext,
    archive: Map<string, Buffer>,
  ): Promise<void> {
    if (
      !archive.has("word/document.xml") ||
      !archive.has("[Content_Types].xml")
    )
      throw new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
    let paragraph = 0,
      table = 0;
    const converted = await mammoth.convertToHtml(
      { buffer: bytes },
      {
        externalFileAccess: false,
        includeEmbeddedStyleMap: false,
        transformDocument: (document: Element) => {
          // Block conversion stops at paragraphs/tables. Inspect descendants
          // separately because Mammoth nests images and noteReference in runs
          // and hyperlinks, and this extractor intentionally omits note bodies.
          const pending = [document];
          while (pending.length) {
            const element = pending.pop()!;
            if (element.type === "image" || element.type === "noteReference")
              context.partial();
            pending.push(...(element.children ?? []));
          }
          const visit = (element: Element) => {
            if (element.type === "paragraph")
              context.text(plainText(element), `body/paragraph:${++paragraph}`);
            else if (element.type === "table") {
              const rows = (element.children ?? []).map((row) =>
                (row.children ?? []).flatMap((cell) => [
                  plainText(cell),
                  ...Array(
                    Math.min(100, Math.max(0, (cell.colSpan ?? 1) - 1)),
                  ).fill(""),
                ]),
              );
              context.table(rows, `body/table:${++table}`);
              if (
                (element.children ?? []).some((row) =>
                  (row.children ?? []).some((cell) => (cell.rowSpan ?? 1) > 1),
                )
              )
                context.partial();
            } else {
              for (const child of element.children ?? []) visit(child);
            }
          };
          visit(document);
          // The typed blocks are collected from Mammoth's document transform hook;
          // suppress HTML generation and embedded-image reads after collection.
          return { ...document, children: [] };
        },
      },
    );
    if (converted.messages.length) context.partial();
  }
}

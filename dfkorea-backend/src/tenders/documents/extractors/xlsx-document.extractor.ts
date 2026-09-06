import { Workbook, Cell } from "exceljs";
import { format, dateToSerial } from "numfmt";
import { TenderDocumentExtractionError } from "../tender-document-extraction.types";
import { ExtractionContext } from "./extraction-context";
export class XlsxDocumentExtractor {
  async extract(
    bytes: Buffer,
    context: ExtractionContext,
    archive: Map<string, Buffer>,
  ): Promise<void> {
    if (!archive.has("xl/workbook.xml") || !archive.has("[Content_Types].xml"))
      throw new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
    const workbook = new Workbook();
    await workbook.xlsx.load(bytes as any);
    context.result.metadata = {
      sheets: workbook.worksheets.map((s) => s.name),
      hiddenSheets: workbook.worksheets
        .filter((s) => s.state !== "visible")
        .map((s) => s.name),
    };
    const display = (cell: Cell): string => {
      if (cell.isMerged && cell.master.address !== cell.address) return "";
      let value = cell.value;
      if (
        value &&
        typeof value === "object" &&
        ("formula" in value || "sharedFormula" in value)
      ) {
        value = cell.result;
        if (value === undefined) {
          context.partial();
          return "";
        }
      }
      if (value === null || value === undefined) return "";
      // ExcelJS has already applied the workbook's 1900/1904 date system and
      // represents spreadsheet wall-clock time in UTC. Never add host timezone.
      if (value instanceof Date)
        return format(
          cell.numFmt || "yyyy-mm-dd",
          dateToSerial(value, { ignoreTimezone: true }),
        );
      if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
      if (typeof value === "number")
        return format(cell.numFmt || "General", value);
      if (typeof value === "object") {
        if ("richText" in value)
          return value.richText.map((run) => run.text).join("");
        if ("text" in value) return value.text;
        if ("error" in value) {
          context.partial();
          return value.error;
        }
        context.partial();
        return "";
      }
      return String(value);
    };
    for (const sheet of workbook.worksheets) {
      if (
        sheet.rowCount > 100_000 ||
        sheet.columnCount > 1000 ||
        sheet.rowCount * sheet.columnCount > 100_000
      )
        throw new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");
      let tableRows: string[][] = [],
        start = 0,
        end = 0;
      const flush = () => {
        if (tableRows.length)
          context.table(tableRows, `sheet:${sheet.name}/rows:${start}-${end}`);
        tableRows = [];
      };
      sheet.eachRow({ includeEmpty: true }, (row, index) => {
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, column) => {
          values[column - 1] = display(cell);
        });
        while (values.length && !values[values.length - 1]) values.pop();
        for (let i = 0; i < values.length; i++) values[i] ??= "";
        if (values.length > 1) {
          if (!tableRows.length) start = index;
          tableRows.push(values);
          end = index;
        } else {
          flush();
          if (values[0])
            context.text(values[0], `sheet:${sheet.name}/row:${index}`);
        }
      });
      flush();
    }
  }
}

import { parentPort, workerData } from "node:worker_threads";
import {
  ExtractionInput,
  TenderDocumentExtractionError,
} from "./tender-document-extraction.types";
import { ExtractionContext } from "./extractors/extraction-context";
import { readBoundedZip } from "./extractors/archive-guard";
import { HwpDocumentExtractor } from "./extractors/hwp-document.extractor";
import { PdfDocumentExtractor } from "./extractors/pdf-document.extractor";
import { DocxDocumentExtractor } from "./extractors/docx-document.extractor";
import { XlsxDocumentExtractor } from "./extractors/xlsx-document.extractor";
import { ZipDocumentExtractor } from "./extractors/zip-document.extractor";

async function run(): Promise<void> {
  const input = workerData as ExtractionInput,
    bytes = Buffer.from(input.bytes),
    context = new ExtractionContext();
  try {
    const archive = ["HWPX", "DOCX", "XLSX", "ZIP"].includes(
      input.detectedFormat,
    )
      ? readBoundedZip(bytes)
      : undefined;
    switch (input.detectedFormat) {
      case "HWP":
      case "HWPX":
        await new HwpDocumentExtractor().extract(bytes, context, archive);
        break;
      case "PDF":
        await new PdfDocumentExtractor().extract(bytes, context);
        break;
      case "DOCX":
        await new DocxDocumentExtractor().extract(bytes, context, archive!);
        break;
      case "XLSX":
        await new XlsxDocumentExtractor().extract(bytes, context, archive!);
        break;
      case "ZIP":
        await new ZipDocumentExtractor().extract(bytes, context, archive!);
        break;
      default:
        throw new TenderDocumentExtractionError("DOCUMENT_UNSUPPORTED");
    }
    if (!context.result.blocks.length)
      throw new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
    parentPort!.postMessage({ result: context.result });
  } catch (error) {
    parentPort!.postMessage({
      code:
        error instanceof TenderDocumentExtractionError
          ? error.code
          : "DOCUMENT_CORRUPT",
    });
  }
}
void run();

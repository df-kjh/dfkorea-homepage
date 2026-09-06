import { join } from "node:path";
import { Worker } from "node:worker_threads";
import {
  ExtractedDocument,
  ExtractionInput,
  ExtractionErrorCode,
  MAX_INPUT_BYTES,
  TenderDocumentExtractionError,
} from "./tender-document-extraction.types";
export * from "./tender-document-extraction.types";

export class TenderDocumentTextExtractor {
  private readonly timeoutMs: number;
  constructor(options: { timeoutMs?: number } = {}) {
    this.timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? 15_000, 15_000));
  }
  async extract(input: ExtractionInput): Promise<ExtractedDocument> {
    if (input.bytes.byteLength > MAX_INPUT_BYTES)
      throw new TenderDocumentExtractionError("DOCUMENT_TOO_LARGE");
    // A Promise timeout cannot interrupt synchronous CFB/XML parsing. Terminating
    // a worker enforces the wall-clock limit and releases each parser's memory.
    const typescript = __filename.endsWith(".ts");
    const worker = new Worker(
      join(
        __dirname,
        `tender-document-extraction.worker.${typescript ? "ts" : "js"}`,
      ),
      {
        workerData: input,
        execArgv: typescript
          ? ["-r", require.resolve("ts-node/register/transpile-only")]
          : [],
        resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 },
        stdout: true,
        stderr: true,
      },
    );
    // Third-party diagnostics may contain document text. Drain without logging.
    worker.stdout.resume();
    worker.stderr.resume();
    let timer: NodeJS.Timeout;
    try {
      return await new Promise<ExtractedDocument>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new TenderDocumentExtractionError("DOCUMENT_TIMEOUT")),
          this.timeoutMs,
        );
        worker.once(
          "message",
          (message: {
            result?: ExtractedDocument;
            code?: ExtractionErrorCode;
          }) => {
            if (message.result) resolve(message.result);
            else
              reject(
                new TenderDocumentExtractionError(
                  message.code ?? "DOCUMENT_CORRUPT",
                ),
              );
          },
        );
        worker.once("error", () =>
          reject(new TenderDocumentExtractionError("DOCUMENT_CORRUPT")),
        );
        worker.once("exit", () =>
          reject(new TenderDocumentExtractionError("DOCUMENT_CORRUPT")),
        );
      });
    } finally {
      clearTimeout(timer!);
      await worker.terminate();
    }
  }
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as loading from "./extraction-context";
import { PdfDocumentExtractor } from "./pdf-document.extractor";

describe("PDF output budget", () => {
  afterEach(() => jest.restoreAllMocks());
  it("counts streamed text once, allowing six MiB below the ten MiB output cap", async () => {
    // Only PDF.js decoding is doubled here: a six MiB glyph stream would test
    // PDF.js performance rather than the application's duplicate accounting.
    const text = "a".repeat(6 * 1024 * 1024);
    let consumed = false;
    jest.spyOn(loading, "importEsm").mockResolvedValue({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            streamTextContent: () => ({
              getReader: () => ({
                read: async () =>
                  consumed
                    ? { done: true }
                    : ((consumed = true),
                      {
                        done: false,
                        value: {
                          items: [
                            {
                              str: text,
                              transform: [12, 0, 0, 12, 50, 700],
                              width: 100,
                              height: 12,
                              hasEOL: true,
                            },
                          ],
                        },
                      }),
                releaseLock: () => undefined,
              }),
            }),
            cleanup: () => undefined,
          }),
        }),
        destroy: async () => undefined,
      }),
    });
    const context = new loading.ExtractionContext();
    await new PdfDocumentExtractor().extract(
      readFileSync(join(__dirname, "../fixtures/sample.pdf")),
      context,
    );
    expect(context.result.blocks).toEqual([
      { kind: "text", ordinal: 0, location: "page:1/paragraph:1", text },
    ]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { guardPdfStreams } from "./pdf-stream-guard";

describe("PDF compressed-stream preflight", () => {
  it.each([
    "/Fil#74er /FlateDecode",
    "/Filter% comment\n/FlateDecode",
    "/Filter [/FlateDecode]",
  ])("applies limits to legal filter spelling %s", (filter) => {
    const original = readFileSync(
      join(__dirname, "../fixtures/ratio-limit.pdf"),
    );
    // Only dictionary spelling changes; the compressed bytes and direct stream
    // length stay intact. Cross-reference offsets are not consumed by preflight.
    const bytes = Buffer.from(
      original.toString("latin1").replace("/Filter /FlateDecode", filter),
      "latin1",
    );
    expect(() => guardPdfStreams(bytes)).toThrow(
      expect.objectContaining({ code: "DOCUMENT_ARCHIVE_LIMIT" }),
    );
  });
  it("ignores misleading obj/stream words inside dictionary strings", () => {
    const original = readFileSync(
      join(__dirname, "../fixtures/ratio-limit.pdf"),
    );
    const bytes = Buffer.from(
      original
        .toString("latin1")
        .replace(
          "/Filter /FlateDecode",
          "/Filter /FlateDecode /Description (1 0 obj)",
        ),
      "latin1",
    );
    expect(() => guardPdfStreams(bytes)).toThrow(
      expect.objectContaining({ code: "DOCUMENT_ARCHIVE_LIMIT" }),
    );
  });
  it("rejects duplicate filter keys instead of trusting the first declaration", () => {
    const original = readFileSync(
      join(__dirname, "../fixtures/ratio-limit.pdf"),
    );
    const bytes = Buffer.from(
      original
        .toString("latin1")
        .replace("/Filter /FlateDecode", "/Filter [] /Filter /FlateDecode"),
      "latin1",
    );
    expect(() => guardPdfStreams(bytes)).toThrow(
      expect.objectContaining({ code: "DOCUMENT_UNSUPPORTED" }),
    );
  });
  it.each(["/F /Fl", "/F [/FlateDecode]", "/#46 /FlateDecode"])(
    "checks bounded alias %s before inflation",
    (filter) => {
      const original = readFileSync(
        join(__dirname, "../fixtures/ratio-limit.pdf"),
      );
      const bytes = Buffer.from(
        original.toString("latin1").replace("/Filter /FlateDecode", filter),
        "latin1",
      );
      expect(() => guardPdfStreams(bytes)).toThrow(
        expect.objectContaining({ code: "DOCUMENT_ARCHIVE_LIMIT" }),
      );
    },
  );
  it.each([
    "/F [] /Filter /FlateDecode",
    "/Filter [] /F /FlateDecode",
    "/F [] /F [/Fl]",
  ])("rejects conflicting filter declarations %s", (filter) => {
    const original = readFileSync(
      join(__dirname, "../fixtures/ratio-limit.pdf"),
    );
    const bytes = Buffer.from(
      original.toString("latin1").replace("/Filter /FlateDecode", filter),
      "latin1",
    );
    expect(() => guardPdfStreams(bytes)).toThrow(
      expect.objectContaining({ code: "DOCUMENT_UNSUPPORTED" }),
    );
  });
});

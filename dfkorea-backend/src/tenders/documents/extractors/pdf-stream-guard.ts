import { inflateSync } from "node:zlib";
import {
  MAX_TEXT_BYTES,
  TenderDocumentExtractionError,
} from "../tender-document-extraction.types";
import { MAX_ENTRIES, MAX_EXPANDED_BYTES } from "./archive-guard";

const whitespace = (byte: number) => [0, 9, 10, 12, 13, 32].includes(byte);
const delimiter = (byte: number) =>
  whitespace(byte) || [40, 41, 60, 62, 91, 93, 123, 125, 47, 37].includes(byte);
const unsupported = () =>
  new TenderDocumentExtractionError("DOCUMENT_UNSUPPORTED");
const corrupt = () => new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
const limit = () => new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");

/** A bounded lexer, not a PDF layout parser. Never interpret binary payload as
 * dictionary syntax: comments, escaped names, literal/hex strings and exact
 * direct stream lengths determine the envelope before PDF.js may decode it.
 * Indirect lengths/filter references and exotic filter chains remain unsupported.
 */
export function guardPdfStreams(bytes: Buffer): void {
  let cursor = 0,
    count = 0,
    total = 0;
  const streams: Array<{ data: Buffer; filters: string[]; image: boolean }> =
    [];
  let objectTokens: string[] | undefined;
  let objectBytes = 0;
  while (cursor < bytes.length) {
    if (whitespace(bytes[cursor])) {
      cursor++;
      continue;
    }
    if (bytes[cursor] === 37) {
      while (cursor < bytes.length && ![10, 13].includes(bytes[cursor]))
        cursor++;
      continue;
    }
    let token: string;
    const start = cursor;
    if (bytes[cursor] === 40) {
      let depth = 1;
      cursor++;
      while (cursor < bytes.length && depth) {
        const byte = bytes[cursor++];
        if (byte === 92) cursor++;
        else if (byte === 40) depth++;
        else if (byte === 41) depth--;
        if (depth > 100) throw limit();
      }
      if (depth) throw corrupt();
      token = "(string)";
    } else if (bytes[cursor] === 60 && bytes[cursor + 1] !== 60) {
      cursor = bytes.indexOf(62, cursor + 1);
      if (cursor < 0) throw corrupt();
      cursor++;
      token = "<hex>";
    } else if (
      (bytes[cursor] === 60 && bytes[cursor + 1] === 60) ||
      (bytes[cursor] === 62 && bytes[cursor + 1] === 62)
    ) {
      token = bytes.toString("ascii", cursor, cursor + 2);
      cursor += 2;
    } else if ([91, 93, 123, 125, 41, 62].includes(bytes[cursor])) {
      token = String.fromCharCode(bytes[cursor++]);
    } else {
      if (bytes[cursor] === 47) cursor++;
      while (cursor < bytes.length && !delimiter(bytes[cursor])) cursor++;
      if (cursor === start || cursor - start > 1024) throw unsupported();
      token = bytes.toString("latin1", start, cursor);
      if (token.startsWith("/"))
        token = token.replace(/#([0-9a-f]{2})/gi, (_match, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
    }
    if (token === "/Encrypt")
      throw new TenderDocumentExtractionError("DOCUMENT_ENCRYPTED");
    if (token === "obj") {
      objectTokens = [];
      objectBytes = 0;
      continue;
    }
    if (token === "endobj") {
      objectTokens = undefined;
      continue;
    }
    if (token !== "stream") {
      if (objectTokens) {
        objectBytes += cursor - start;
        if (objectBytes > 65536) throw unsupported();
        objectTokens.push(token);
      }
      continue;
    }
    if (
      !objectTokens ||
      objectTokens[0] !== "<<" ||
      objectTokens[objectTokens.length - 1] !== ">>"
    )
      throw corrupt();
    if (++count > MAX_ENTRIES) throw limit();
    if (
      ["/Filter", "/Length"].some(
        (key) => objectTokens!.filter((token) => token === key).length > 1,
      )
    )
      throw unsupported();
    const dictionary = objectTokens.join(" ");
    const lengthMatch = /\/Length\s+(\d+)(\s+\d+\s+R)?\b/.exec(dictionary);
    if (!lengthMatch || lengthMatch[2]) throw unsupported();
    if (bytes[cursor] === 13) cursor++;
    if (bytes[cursor] === 10) cursor++;
    else if (bytes[cursor - 1] !== 13) throw corrupt();
    const length = Number(lengthMatch[1]),
      end = cursor + length;
    if (!Number.isSafeInteger(length) || end > bytes.length) throw corrupt();
    let after = end;
    while (whitespace(bytes[after])) after++;
    if (bytes.toString("ascii", after, after + 9) !== "endstream")
      throw corrupt();
    const filterIndex = objectTokens.indexOf("/Filter");
    let filters: string[] = [];
    if (filterIndex >= 0) {
      if (objectTokens[filterIndex + 1] === "[") {
        const close = objectTokens.indexOf("]", filterIndex + 2);
        if (close < 0) throw corrupt();
        filters = objectTokens.slice(filterIndex + 2, close);
      } else filters = [objectTokens[filterIndex + 1]];
    }
    const image = /\/Subtype\s*\/Image\b/.test(dictionary);
    streams.push({ data: bytes.subarray(cursor, end), filters, image });
    cursor = after + 9;
    objectTokens = undefined;
  }
  // Scan the complete envelope for trailer encryption before trying to inflate
  // any encrypted bytes; otherwise ordinary encrypted Flate PDFs look corrupt.
  for (const { data, filters, image } of streams) {
    const length = data.length;
    let expanded = length;
    if (filters.length === 1 && ["/FlateDecode", "/Fl"].includes(filters[0])) {
      try {
        expanded = inflateSync(data, {
          maxOutputLength: Math.max(
            1,
            Math.min(MAX_EXPANDED_BYTES - total, length * 100),
          ),
        }).length;
      } catch (error) {
        throw error.code === "ERR_BUFFER_TOO_LARGE" ? limit() : corrupt();
      }
    } else if (
      filters.length &&
      !(
        image &&
        filters.length === 1 &&
        /^\/(DCTDecode|JPXDecode|JBIG2Decode|CCITTFaxDecode|ASCIIHexDecode)$/.test(
          filters[0],
        )
      )
    )
      throw unsupported();
    total += expanded;
    if (total > MAX_EXPANDED_BYTES) throw limit();
    if (!image && expanded > MAX_TEXT_BYTES)
      throw new TenderDocumentExtractionError("DOCUMENT_TEXT_LIMIT");
  }
}

import { inflateRawSync } from "node:zlib";
import { XMLValidator } from "fast-xml-parser";
import {
  MAX_TEXT_BYTES,
  TenderDocumentExtractionError,
} from "../tender-document-extraction.types";

export const MAX_ENTRIES = 4096;
export const MAX_EXPANDED_BYTES = 40 * 1024 * 1024;
const MAX_RATIO = 100;
const corrupt = () => new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
const limit = () => new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");

export interface ArchiveBudget {
  entries: number;
  expandedBytes: number;
  xmlBytes: number;
}

export const createArchiveBudget = (): ArchiveBudget => ({
  entries: 0,
  expandedBytes: 0,
  xmlBytes: 0,
});

interface ReadBoundedZipOptions {
  budget?: ArchiveBudget;
  validatePackageXml?: boolean;
}
export function boundedInflate(
  data: Buffer,
  maximum = MAX_EXPANDED_BYTES,
): Buffer {
  try {
    return inflateRawSync(data, {
      maxOutputLength: Math.max(1, Math.min(maximum, data.length * MAX_RATIO)),
    });
  } catch (error) {
    if (error.code === "ERR_BUFFER_TOO_LARGE") throw limit();
    throw corrupt();
  }
}
export function validateXml(bytes: Buffer): string {
  // Conservative source budget also bounds the parser AST and entity processing,
  // before decoding XML into strings. DTD/entity definitions are not needed by OOXML.
  if (bytes.length > MAX_TEXT_BYTES)
    throw new TenderDocumentExtractionError("DOCUMENT_TEXT_LIMIT");
  const text = bytes.toString("utf8");
  if (
    /<!\s*(DOCTYPE|ENTITY)/i.test(text) ||
    XMLValidator.validate(text) !== true
  )
    throw corrupt();
  return text;
}
const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
export function validateBoundedZipXml(
  files: Map<string, Buffer>,
  budget: ArchiveBudget,
): void {
  for (const [name, contents] of files) {
    if (!/\.(xml|rels|hpf)$/i.test(name)) continue;
    budget.xmlBytes += contents.length;
    if (budget.xmlBytes > MAX_TEXT_BYTES)
      throw new TenderDocumentExtractionError("DOCUMENT_TEXT_LIMIT");
    validateXml(contents);
  }
}

export function readBoundedZip(
  buffer: Buffer,
  options: ReadBoundedZipOptions = {},
): Map<string, Buffer> {
  try {
    const budget = options.budget ?? createArchiveBudget();
    let end = -1;
    for (
      let i = buffer.length - 22;
      i >= Math.max(0, buffer.length - 65557);
      i--
    )
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        end = i;
        break;
      }
    if (end < 0 || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length)
      throw corrupt();
    const count = buffer.readUInt16LE(end + 10),
      central = buffer.readUInt32LE(end + 16);
    if (count > MAX_ENTRIES || budget.entries + count > MAX_ENTRIES)
      throw limit();
    if (
      !count ||
      buffer.readUInt16LE(end + 4) ||
      buffer.readUInt16LE(end + 6) ||
      buffer.readUInt16LE(end + 8) !== count ||
      central + buffer.readUInt32LE(end + 12) !== end
    )
      throw corrupt();
    budget.entries += count;
    const files = new Map<string, Buffer>();
    let offset = central;
    const ranges: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
        throw corrupt();
      const flags = buffer.readUInt16LE(offset + 8),
        method = buffer.readUInt16LE(offset + 10),
        compressed = buffer.readUInt32LE(offset + 20),
        expanded = buffer.readUInt32LE(offset + 24),
        nameLength = buffer.readUInt16LE(offset + 28),
        extra = buffer.readUInt16LE(offset + 30),
        comment = buffer.readUInt16LE(offset + 32),
        local = buffer.readUInt32LE(offset + 42);
      if (flags & 1)
        throw new TenderDocumentExtractionError("DOCUMENT_ENCRYPTED");
      const next = offset + 46 + nameLength + extra + comment;
      if (
        !nameLength ||
        next > end ||
        local + 30 > central ||
        buffer.readUInt32LE(local) !== 0x04034b50 ||
        flags & ~(method === 8 ? 0x080e : 0x0808) ||
        ![0, 8].includes(method) ||
        buffer.readUInt16LE(offset + 34)
      )
        throw corrupt();
      if (
        expanded > MAX_EXPANDED_BYTES ||
        compressed === 0xffffffff ||
        expanded > Math.max(1, compressed) * MAX_RATIO ||
        budget.expandedBytes + expanded > MAX_EXPANDED_BYTES
      )
        throw limit();
      const name = buffer.toString(
        "utf8",
        offset + 46,
        offset + 46 + nameLength,
      );
      if (
        files.has(name) ||
        name.includes("\0") ||
        name.includes("\\") ||
        Buffer.byteLength(name, "utf8") > 512 ||
        /^[A-Za-z]:\//.test(name) ||
        name.split("/").includes("..") ||
        name.startsWith("/")
      )
        throw corrupt();
      const localName = buffer.readUInt16LE(local + 26),
        data = local + 30 + localName + buffer.readUInt16LE(local + 28);
      if (
        data + compressed > central ||
        buffer.readUInt16LE(local + 6) !== flags ||
        buffer.readUInt16LE(local + 8) !== method ||
        buffer.toString("utf8", local + 30, local + 30 + localName) !== name
      )
        throw corrupt();
      if (
        !(flags & 8) &&
        (buffer.readUInt32LE(local + 18) !== compressed ||
          buffer.readUInt32LE(local + 22) !== expanded ||
          buffer.readUInt32LE(local + 14) !== buffer.readUInt32LE(offset + 16))
      )
        throw corrupt();
      ranges.push([local, data + compressed]);
      const source = buffer.subarray(data, data + compressed);
      let contents: Buffer;
      // The actual output cap catches forged size fields before unbounded inflate.
      try {
        contents =
          method === 0
            ? source
            : inflateRawSync(source, {
                maxOutputLength: Math.max(1, expanded),
              });
      } catch {
        throw corrupt();
      }
      if (
        contents.length !== expanded ||
        crc32(contents) !== buffer.readUInt32LE(offset + 16)
      )
        throw corrupt();
      budget.expandedBytes += contents.length;
      files.set(name, contents);
      offset = next;
    }
    ranges.sort((a, b) => a[0] - b[0]);
    if (
      offset !== end ||
      ranges.some((r, i) => i > 0 && r[0] < ranges[i - 1][1])
    )
      throw corrupt();
    if (options.validatePackageXml !== false) {
      validateBoundedZipXml(files, budget);
    }
    return files;
  } catch (error) {
    if (error instanceof TenderDocumentExtractionError) throw error;
    throw corrupt();
  }
}

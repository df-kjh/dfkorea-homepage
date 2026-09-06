import { TenderDocumentTextExtractor } from "../tender-document-extractor";
import { readBoundedCfb } from "./cfb-guard";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as CFB from "cfb";
import { HwpDocumentExtractor } from "./hwp-document.extractor";
import * as context from "./extraction-context";

const original = readFileSync(join(__dirname, "../fixtures/sample.hwp"));
// Test-only fixture metadata navigation; never uses the production guard.
function directoryOffset(bytes: Buffer, name: string): number {
  let sector = bytes.readUInt32LE(48);
  const fat = (bytes.readUInt32LE(76) + 1) * 512;
  while (sector !== 0xfffffffe) {
    const start = (sector + 1) * 512;
    for (let offset = start; offset < start + 512; offset += 128) {
      const length = bytes.readUInt16LE(offset + 64);
      if (
        length >= 2 &&
        bytes.toString("utf16le", offset, offset + length - 2) === name
      )
        return offset;
    }
    sector = bytes.readUInt32LE(fat + sector * 4);
  }
  throw new Error("test entry missing");
}
function regularFixture(): Buffer {
  const file = CFB.read(original, { type: "buffer" });
  CFB.utils.cfb_add(file, "BlobA", Buffer.alloc(4096, 65));
  CFB.utils.cfb_add(file, "BlobB", Buffer.alloc(4096, 66));
  return CFB.write(file, { type: "buffer" });
}
const mutate = (source: Buffer, change: (copy: Buffer) => void) => {
  const copy = Buffer.from(source);
  change(copy);
  return copy;
};
const regular = regularFixture();
const fatAt = (bytes: Buffer, id: number) =>
  (bytes.readUInt32LE(76) + 1) * 512 + id * 4;
function entryLimitFixture(): Buffer {
  const file = CFB.utils.cfb_new();
  for (let i = 0; i < 4097; i++)
    CFB.utils.cfb_add(file, `Entry${i}`, Buffer.alloc(0), { unsafe: true });
  return CFB.write(file, { type: "buffer" });
}
function versionFourFixture(): Buffer {
  const bytes = Buffer.alloc(5 * 4096);
  original.subarray(0, 512).copy(bytes);
  bytes.writeUInt16LE(4, 26);
  bytes.writeUInt16LE(12, 30);
  bytes.writeUInt32LE(1, 40);
  bytes.writeUInt32LE(1, 48);
  bytes.writeUInt32LE(2, 60);
  bytes.fill(255, 4096, 8192);
  [0xfffffffd, 0xfffffffe, 0xfffffffe, 0xfffffffe].forEach((value, index) =>
    bytes.writeUInt32LE(value, 4096 + index * 4),
  );
  original.subarray(1536, 2560).copy(bytes, 8192);
  bytes.writeUInt32LE(3, 8192 + 116);
  bytes.fill(255, 12288, 16384);
  original.subarray(1024, 1536).copy(bytes, 12288);
  original.subarray(2560, 3200).copy(bytes, 16384);
  return bytes;
}
const cases: Array<[string, () => Buffer, string]> = [
  ["excess directory entries", entryLimitFixture, "DOCUMENT_ARCHIVE_LIMIT"],
  [
    "oversized FAT count",
    () => mutate(original, (b) => b.writeUInt32LE(0xffffffff, 44)),
    "DOCUMENT_ARCHIVE_LIMIT",
  ],
  [
    "oversized DIFAT count",
    () => mutate(original, (b) => b.writeUInt32LE(0xffffffff, 72)),
    "DOCUMENT_ARCHIVE_LIMIT",
  ],
  [
    "oversized miniFAT count",
    () => mutate(original, (b) => b.writeUInt32LE(0xffffffff, 64)),
    "DOCUMENT_ARCHIVE_LIMIT",
  ],
  [
    "oversized declared stream",
    () =>
      mutate(original, (b) =>
        b.writeBigUInt64LE(1n << 40n, directoryOffset(b, "FileHeader") + 120),
      ),
    "DOCUMENT_ARCHIVE_LIMIT",
  ],
  [
    "oversized root mini stream",
    () =>
      mutate(original, (b) =>
        b.writeBigUInt64LE(1n << 40n, directoryOffset(b, "Root Entry") + 120),
      ),
    "DOCUMENT_ARCHIVE_LIMIT",
  ],
  [
    "aggregate declared streams",
    () =>
      mutate(regular, (b) => {
        for (const name of ["BlobA", "BlobB"])
          b.writeBigUInt64LE(
            21n * 1024n * 1024n,
            directoryOffset(b, name) + 120,
          );
      }),
    "DOCUMENT_ARCHIVE_LIMIT",
  ],
  [
    "cyclic directory sector chain",
    () =>
      mutate(original, (b) => {
        const id = b.readUInt32LE(48);
        b.writeUInt32LE(id, fatAt(b, id));
      }),
    "DOCUMENT_CORRUPT",
  ],
  [
    "cyclic miniFAT sector chain",
    () =>
      mutate(original, (b) => {
        const id = b.readUInt32LE(60);
        b.writeUInt32LE(id, fatAt(b, id));
      }),
    "DOCUMENT_CORRUPT",
  ],
  [
    "cyclic mini stream chain",
    () =>
      mutate(original, (b) => {
        const id = b.readUInt32LE(directoryOffset(b, "FileHeader") + 116);
        b.writeUInt32LE(id, (b.readUInt32LE(60) + 1) * 512 + id * 4);
      }),
    "DOCUMENT_CORRUPT",
  ],
  [
    "overlapping mini streams",
    () =>
      mutate(original, (b) =>
        b.writeUInt32LE(
          b.readUInt32LE(directoryOffset(b, "DocInfo") + 116),
          directoryOffset(b, "FileHeader") + 116,
        ),
      ),
    "DOCUMENT_CORRUPT",
  ],
  [
    "overlapping regular streams",
    () =>
      mutate(regular, (b) =>
        b.writeUInt32LE(
          b.readUInt32LE(directoryOffset(b, "BlobA") + 116),
          directoryOffset(b, "BlobB") + 116,
        ),
      ),
    "DOCUMENT_CORRUPT",
  ],
  [
    "truncated regular stream",
    () =>
      mutate(regular, (b) =>
        b.writeUInt32LE(
          0xfffffffe,
          fatAt(b, b.readUInt32LE(directoryOffset(b, "BlobA") + 116)),
        ),
      ),
    "DOCUMENT_CORRUPT",
  ],
  [
    "cyclic regular stream",
    () =>
      mutate(regular, (b) => {
        const id = b.readUInt32LE(directoryOffset(b, "BlobA") + 116);
        b.writeUInt32LE(id, fatAt(b, id));
      }),
    "DOCUMENT_CORRUPT",
  ],
  [
    "directory child cycle",
    () =>
      mutate(original, (b) =>
        b.writeUInt32LE(0, directoryOffset(b, "BodyText") + 76),
      ),
    "DOCUMENT_CORRUPT",
  ],
  [
    "truncated physical sector",
    () => original.subarray(0, original.length - 1),
    "DOCUMENT_CORRUPT",
  ],
  [
    "cyclic DIFAT",
    () => {
      const b = Buffer.concat([original, Buffer.alloc(512, 255)]),
        id = original.length / 512 - 1;
      b.writeUInt32LE(id, 68);
      b.writeUInt32LE(1, 72);
      b.writeUInt32LE(id, b.length - 4);
      b.writeUInt32LE(0xfffffffc, fatAt(b, id));
      return b;
    },
    "DOCUMENT_CORRUPT",
  ],
];

describe("untrusted CFB metadata boundary", () => {
  afterEach(() => jest.restoreAllMocks());
  it("accepts an empty stream's conventional zero start without following sector zero", () => {
    const file = CFB.utils.cfb_new();
    CFB.utils.cfb_add(file, "Empty", Buffer.alloc(0));
    const streams = readBoundedCfb(CFB.write(file, { type: "buffer" }));
    expect(streams.get("Empty")).toEqual(Buffer.alloc(0));
  });
  it("reads bounded regular streams with distinct contents", () => {
    const streams = readBoundedCfb(regular);
    expect(streams.get("BlobA")).toEqual(Buffer.alloc(4096, 65));
    expect(streams.get("BlobB")).toEqual(Buffer.alloc(4096, 66));
    expect(streams.get("FileHeader")?.subarray(0, 17).toString("ascii")).toBe(
      "HWP Document File",
    );
  });
  it("supports v4 sector layout without exposing its allocation tables to hwp-convert", async () => {
    const result = await new TenderDocumentTextExtractor().extract({
      bytes: versionFourFixture(),
      detectedFormat: "HWP",
    });
    expect(result.status).toBe("EXTRACTED");
    expect(result.blocks[0]).toMatchObject({
      kind: "text",
      text: "소비전력 50W 이하",
    });
    expect(result.blocks[3]).toMatchObject({
      kind: "table",
      rows: [
        ["항목", "기준"],
        ["소비전력", "50W 이하"],
        ["광효율", "130 lm/W 이상"],
      ],
    });
  });
  it.each(cases)(
    "rejects %s before any eager CFB reader",
    async (_name, fixture, code) => {
      const bytes = fixture();
      // A dangerous metadata probe must never reach the eager library. This
      // sentinel prevents that allocation during RED and proves the call boundary.
      const eager = jest.spyOn(CFB, "read").mockImplementation(() => {
        throw new Error("untrusted CFB reader invoked");
      });
      jest.spyOn(context, "importEsm").mockResolvedValue({});
      await expect(
        new HwpDocumentExtractor().extract(
          bytes,
          new context.ExtractionContext(),
        ),
      ).rejects.toMatchObject({ code });
      expect(eager).not.toHaveBeenCalled();
    },
  );
});

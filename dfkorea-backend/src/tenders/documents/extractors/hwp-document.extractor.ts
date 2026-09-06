import { readBoundedCfb } from "./cfb-guard";
import * as CFB from "cfb";
import { XMLParser } from "fast-xml-parser";
import {
  MAX_TEXT_BYTES,
  TenderDocumentExtractionError,
} from "../tender-document-extraction.types";
import {
  boundedInflate,
  MAX_EXPANDED_BYTES,
  validateXml,
} from "./archive-guard";
import { ExtractionContext, importEsm } from "./extraction-context";

type XmlNode = Record<string, any>;
const orderedXml = (bytes: Buffer): XmlNode[] =>
  new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
  }).parse(validateXml(bytes));
const children = (node: XmlNode, tag: string): XmlNode[] => node[tag] ?? [];
const textOf = (nodes: XmlNode[]): string =>
  nodes
    .map(
      (node) =>
        node["#text"] ??
        Object.entries(node)
          .filter(([key]) => key !== ":@")
          .map(([, value]) => (Array.isArray(value) ? textOf(value) : ""))
          .join(""),
    )
    .join("");
const descendants = (nodes: XmlNode[], tag: string): XmlNode[] =>
  nodes.flatMap((node) =>
    node[tag]
      ? [node]
      : Object.entries(node)
          .filter(([key]) => key !== ":@")
          .flatMap(([, value]) =>
            Array.isArray(value) ? descendants(value, tag) : [],
          ),
  );
const corrupt = () => new TenderDocumentExtractionError("DOCUMENT_CORRUPT");

// hwp-convert's IR removes inline control positions. Recover table anchors
// from bounded PARA_TEXT records so text following a table stays after it.
function tableTextOffsets(data: Buffer): number[] {
  const offsets: number[] = [];
  let position = 0;
  for (let index = 0; index < data.length; ) {
    const char = data.readUInt16LE(index);
    if (char === 13) break;
    if (
      char === 9 ||
      (char >= 1 && char <= 8) ||
      char === 11 ||
      char === 12 ||
      (char >= 14 && char <= 23)
    ) {
      if (index + 16 > data.length) throw corrupt();
      if (
        char === 11 &&
        data.toString("ascii", index + 2, index + 6) === " lbt"
      )
        offsets.push(position);
      if (char === 9) position++;
      index += 16;
    } else {
      if (char >= 32 || [10, 24, 25, 30, 31].includes(char)) position++;
      index += 2;
    }
  }
  return offsets;
}

export class HwpDocumentExtractor {
  async extract(
    bytes: Buffer,
    context: ExtractionContext,
    archive?: Map<string, Buffer>,
  ): Promise<void> {
    const hwp = await importEsm("hwp-convert");
    if (archive) {
      if (
        !archive.has("META-INF/container.xml") ||
        !archive.has("Contents/content.hpf")
      )
        throw corrupt();
      const reader = new hwp.HwpxReader();
      await reader.loadFromArrayBuffer(Uint8Array.from(bytes).buffer);
      const info = await reader.getDocumentInfo();
      if (info.summary.hasEncryptionInfo)
        throw new TenderDocumentExtractionError("DOCUMENT_ENCRYPTED");
      // Respect the package spine, not ZIP insertion or lexicographic filename order.
      const manifest = info.summary.manifest ?? [];
      const sections: string[] = (info.summary.spine ?? [])
        .map((id: string) => manifest.find((item: any) => item.id === id)?.href)
        .filter((path: unknown) => typeof path === "string")
        .map((path: string) =>
          path.startsWith("Contents/") ? path : `Contents/${path}`,
        );
      if (!sections.length)
        sections.push(
          ...[...archive.keys()]
            .filter((path) => /^Contents\/section\d+\.xml$/.test(path))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
        );
      if (!sections.length) throw corrupt();
      sections.forEach((path, index) => {
        const source = archive.get(path);
        if (!source) throw corrupt();
        let paragraph = 0,
          table = 0;
        const visit = (nodes: XmlNode[]) => {
          for (const node of nodes) {
            if (node.tbl) {
              const rows = children(node, "tbl")
                .filter((n) => n.tr)
                .map((row) =>
                  children(row, "tr")
                    .filter((n) => n.tc)
                    .map((cell) =>
                      descendants(children(cell, "tc"), "p")
                        .map((p) => textOf([p]))
                        .join("\n"),
                    ),
                );
              if (!rows.length) throw corrupt();
              context.table(rows, `section:${index + 1}/table:${++table}`);
              if (descendants(node.tbl, "pic").length) context.partial();
            } else if (node.p) {
              // Runs can contain tables between text fragments: flush at each table.
              let pending = "";
              const flush = () => {
                if (pending.trim())
                  context.text(
                    pending,
                    `section:${index + 1}/paragraph:${++paragraph}`,
                  );
                pending = "";
              };
              const inline = (items: XmlNode[]) => {
                for (const item of items) {
                  if (item.tbl) {
                    flush();
                    visit([item]);
                  } else if (item["#text"] !== undefined)
                    pending += item["#text"];
                  else if (item.pic) context.partial();
                  else
                    for (const [key, value] of Object.entries(item))
                      if (key !== ":@" && Array.isArray(value)) inline(value);
                }
              };
              inline(node.p);
              flush();
            } else
              for (const [key, value] of Object.entries(node))
                if (key !== ":@" && Array.isArray(value)) visit(value);
          }
        };
        visit(orderedXml(source));
      });
      return;
    }
    if (bytes.subarray(0, 17).toString("ascii") === "HWP Document File")
      throw new TenderDocumentExtractionError("DOCUMENT_UNSUPPORTED");
    if (
      bytes.length < 512 ||
      bytes.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1"
    )
      throw corrupt();
    const streams = readBoundedCfb(bytes);
    const headerBytes = streams.get("FileHeader");
    if (headerBytes?.length !== 256) throw corrupt();
    const header = Buffer.from(headerBytes),
      info = hwp.parseFileHeader(header);
    if (info.flags.encrypted || info.flags.publicKeyEncrypted || info.flags.drm)
      throw new TenderDocumentExtractionError("DOCUMENT_ENCRYPTED");
    if (!hwp.isVersionSupported(info.version) || info.flags.distribution)
      throw new TenderDocumentExtractionError("DOCUMENT_UNSUPPORTED");
    // hwp-convert uses unbounded pako inflation and loads BinData eagerly. Pass an
    // in-memory, uncompressed CFB containing only preflighted document streams.
    const safe = CFB.utils.cfb_new();
    header.writeUInt32LE(info.flags.raw & ~1, 36);
    CFB.utils.cfb_add(safe, "FileHeader", header);
    let expanded = 0,
      textBytes = 0;
    const sectionNames: string[] = [];
    const sectionOffsets = new Map<string, number[][]>();
    for (const [path, content] of streams) {
      if (path !== "DocInfo" && !/^BodyText\/Section\d+$/.test(path)) continue;
      const raw = content,
        data = info.flags.compressed
          ? boundedInflate(raw, MAX_EXPANDED_BYTES - expanded)
          : raw;
      expanded += data.length;
      if (expanded > MAX_EXPANDED_BYTES)
        throw new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");
      let pos = 0;
      const paragraphOffsets: number[][] = [];
      while (pos < data.length) {
        if (pos + 4 > data.length) throw corrupt();
        const record = data.readUInt32LE(pos),
          tag = record & 1023;
        let size = record >>> 20;
        pos += 4;
        if (size === 4095) {
          if (pos + 4 > data.length) throw corrupt();
          size = data.readUInt32LE(pos);
          pos += 4;
        }
        if (pos + size > data.length || ((record >>> 10) & 1023) > 100)
          throw corrupt();
        if (tag === 66 && ((record >>> 10) & 1023) === 0)
          paragraphOffsets.push([]);
        if (tag === 67) {
          if (size % 2) throw corrupt();
          if (((record >>> 10) & 1023) === 1 && paragraphOffsets.length)
            paragraphOffsets[paragraphOffsets.length - 1] = tableTextOffsets(
              data.subarray(pos, pos + size),
            );
          for (let at = pos; at < pos + size; at += 2) {
            const ch = data.readUInt16LE(at);
            textBytes += ch < 128 ? 1 : ch < 2048 ? 2 : 3;
          }
          if (textBytes > MAX_TEXT_BYTES)
            throw new TenderDocumentExtractionError("DOCUMENT_TEXT_LIMIT");
        }
        pos += size;
      }
      CFB.utils.cfb_add(safe, path, data);
      if (path.startsWith("BodyText/")) {
        sectionNames.push(path);
        sectionOffsets.set(path, paragraphOffsets);
      }
    }
    sectionNames.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (
      !CFB.find(safe, "/DocInfo") ||
      !sectionNames.length ||
      sectionNames.some((path, i) => path !== `BodyText/Section${i}`)
    )
      throw corrupt();
    const document = hwp.parseHwp(CFB.write(safe, { type: "buffer" }));
    document.sections.forEach((section: any, index: number) => {
      let paragraph = 0,
        table = 0;
      if (!section.paragraphs.length) context.partial();
      for (const [paragraphIndex, p] of section.paragraphs.entries()) {
        const offsets =
          sectionOffsets.get(`BodyText/Section${index}`)?.[paragraphIndex] ??
          [];
        const tableCount = p.controls.filter(
          (ctrl: any) => ctrl.kind === "table",
        ).length;
        const inline = tableCount > 0 && offsets.length === tableCount;
        let textCursor = 0,
          tableIndex = 0;
        const emitText = (text: string) => {
          if (text.trim())
            context.text(text, `section:${index + 1}/paragraph:${++paragraph}`);
        };
        if (!inline) {
          emitText(p.text);
          if (tableCount && p.text.trim()) context.partial();
        }
        for (const ctrl of p.controls) {
          if (ctrl.kind === "table") {
            if (inline) {
              const next = offsets[tableIndex++];
              emitText(p.text.slice(textCursor, next));
              textCursor = next;
            }
            if (
              ctrl.rowCount < 1 ||
              ctrl.colCount < 1 ||
              ctrl.rowCount * ctrl.colCount > 100_000
            )
              throw new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");
            const rows: string[][] = Array.from({ length: ctrl.rowCount }, () =>
              Array(ctrl.colCount).fill(""),
            );
            for (const cell of ctrl.cells) {
              if (!rows[cell.row] || cell.col >= ctrl.colCount) throw corrupt();
              rows[cell.row][cell.col] = cell.paragraphs
                .map((p: any) => p.text)
                .join("\n");
              if (cell.paragraphs.some((p: any) => p.controls.length))
                context.partial();
            }
            context.table(rows, `section:${index + 1}/table:${++table}`);
          } else if (!["sectionDef", "columnDef"].includes(ctrl.kind))
            context.partial();
        }
        if (inline) emitText(p.text.slice(textCursor));
      }
    });
  }
}

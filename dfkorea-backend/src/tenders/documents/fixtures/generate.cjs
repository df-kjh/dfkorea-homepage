// Synthetic, redistribution-safe requirements. Run from the backend directory.
// This writer never calls an extractor or produces expected test values.
const { writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");
const { deflateRawSync, deflateSync } = require("node:zlib");
const CFB = require("cfb");
const JSZip = require("jszip");
const ExcelJS = require("exceljs");
const facts = ["소비전력 50W 이하", "광효율 130 lm/W 이상", "고효율 인증 필수"];
const rows = [
  ["항목", "기준"],
  ["소비전력", "50W 이하"],
  ["광효율", "130 lm/W 이상"],
];
const save = (name, bytes) => writeFileSync(join(__dirname, name), bytes);
const rec = (tag, level, data) => {
  const b = Buffer.alloc(data.length < 4095 ? 4 : 8);
  b.writeUInt32LE(
    (tag | (level << 10) | (Math.min(data.length, 4095) << 20)) >>> 0,
  );
  if (b.length === 8) b.writeUInt32LE(data.length, 4);
  return Buffer.concat([b, data]);
};
const para = (text, level = 0) => {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(text.length + 1);
  return Buffer.concat([
    rec(66, level, header),
    rec(67, level + 1, Buffer.from(text + "\r", "utf16le")),
  ]);
};
function hwp(flags = 1, version = 5, inline = false) {
  const cfb = CFB.utils.cfb_new();
  const header = Buffer.alloc(256);
  header.write("HWP Document File");
  header[35] = version;
  header.writeUInt32LE(flags, 36);
  CFB.utils.cfb_add(cfb, "FileHeader", header);
  const meta = Buffer.alloc(8);
  meta.writeUInt16LE(3, 4);
  meta.writeUInt16LE(2, 6);
  const tableControl = Buffer.alloc(16);
  tableControl.writeUInt16LE(11);
  Buffer.from(" lbt").copy(tableControl, 2);
  tableControl.writeUInt16LE(11, 14);
  const body = [
    ...facts.map((t) => para(t)),
    para(
      inline
        ? "표 앞 조건" + tableControl.toString("utf16le") + "표 뒤 조건"
        : "",
    ),
    rec(71, 1, Buffer.concat([Buffer.from(" lbt"), Buffer.alloc(40)])),
    rec(77, 2, meta),
  ];
  rows.forEach((row, r) =>
    row.forEach((text, c) => {
      const cell = Buffer.alloc(38);
      cell.writeUInt16LE(1);
      cell.writeUInt16LE(c, 8);
      cell.writeUInt16LE(r, 10);
      cell.writeUInt16LE(1, 12);
      cell.writeUInt16LE(1, 14);
      cell.writeUInt32LE(15000, 16);
      cell.writeUInt32LE(3000, 20);
      body.push(rec(72, 2, cell), para(text, 2));
    }),
  );
  const info = rec(16, 0, Buffer.from([1, 0, ...Array(24).fill(0)]));
  CFB.utils.cfb_add(cfb, "DocInfo", flags & 1 ? deflateRawSync(info) : info);
  CFB.utils.cfb_add(
    cfb,
    "BodyText/Section0",
    flags & 1 ? deflateRawSync(Buffer.concat(body)) : Buffer.concat(body),
  );
  return CFB.write(cfb, { type: "buffer" });
}
const xml = (s) => '<?xml version="1.0" encoding="UTF-8"?>' + s;
async function docx(content) {
  const z = new JSZip();
  z.file(
    "[Content_Types].xml",
    xml(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
  );
  z.file(
    "_rels/.rels",
    xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
  );
  z.file(
    "word/document.xml",
    xml(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        content +
        "<w:sectPr/></w:body></w:document>",
    ),
  );
  return z;
}
const p = (t) => "<w:p><w:r><w:t>" + t + "</w:t></w:r></w:p>";
function pdf(
  imageOnly = false,
  partial = false,
  encrypted = false,
  bomb = false,
) {
  const chars = [...new Set([...facts, ...rows.flat()].join(""))];
  const cmap =
    "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Fixture def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange " +
    chars.length +
    " beginbfchar " +
    chars
      .map((c) => {
        let s = c.charCodeAt(0).toString(16).padStart(4, "0");
        return "<" + s + "> <" + s + ">";
      })
      .join("\n") +
    " endbfchar endcmap CMapName currentdict /CMap defineresource pop end end";
  const str = (t) => Buffer.from(t, "utf16le").swap16().toString("hex");
  const text = (t, x, y) =>
    `BT /F1 12 Tf 1 0 0 1 ${x} ${y} Tm <${str(t)}> Tj ET\n`;
  let stream = facts.map((f, i) => text(f, 50, 750 - i * 25)).join("");
  rows.forEach((row, r) =>
    row.forEach((t, c) => (stream += text(t, 50 + c * 250, 625 - r * 25))),
  );
  stream +=
    "0.5 w 45 560 500 85 re S 295 560 m 295 645 l S 45 615 m 545 615 l S 45 590 m 545 590 l S\n";
  const imageStream = "q 50 0 0 50 50 700 cm /Im1 Do Q";
  const wrap = (s) =>
    `<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}\nendstream`;
  const objects = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [3 0 R ${partial ? "10 0 R" : ""}] /Count ${partial ? 2 : 1} >>`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 8 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /HYGoThic-Medium /Encoding /Identity-H /DescendantFonts [5 0 R] /ToUnicode 6 0 R >>",
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYGoThic-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 0 >> /DW 500 /FontDescriptor << /Type /FontDescriptor /FontName /HYGoThic-Medium /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >> >>",
    wrap(cmap),
    wrap(imageOnly ? imageStream : stream),
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 7 >>\nstream\nffffff>\nendstream",
    wrap(imageStream),
  ];
  if (partial)
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 8 0 R >> >> /Contents 9 0 R >>",
    );
  if (bomb) {
    const compressed = deflateSync(Buffer.alloc(11 * 1024 * 1024, 65));
    objects.push(
      `<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n${compressed.toString("latin1")}\nendstream`,
    );
  }
  if (encrypted) {
    // PDF Standard security revision 2: deterministic real RC4 encryption.
    // Test password: fixture-user. No fixture plaintext is confidential.
    const padding = Buffer.from(
      "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
      "hex",
    );
    const pad = (value) =>
      Buffer.concat([Buffer.from(value), padding]).subarray(0, 32);
    const md5 = (value) => createHash("md5").update(value).digest();
    const rc4 = (key, value) => {
      const state = Array.from({ length: 256 }, (_, i) => i);
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + state[i] + key[i % key.length]) & 255;
        [state[i], state[j]] = [state[j], state[i]];
      }
      let i = 0;
      j = 0;
      return Buffer.from(
        [...value].map((byte) => {
          i = (i + 1) & 255;
          j = (j + state[i]) & 255;
          [state[i], state[j]] = [state[j], state[i]];
          return byte ^ state[(state[i] + state[j]) & 255];
        }),
      );
    };
    const owner = rc4(
      md5(pad("fixture-owner")).subarray(0, 5),
      pad("fixture-user"),
    );
    const permission = Buffer.alloc(4);
    permission.writeInt32LE(-4);
    const id = Buffer.from("11223344556677889900112233445566", "hex");
    const key = md5(
      Buffer.concat([pad("fixture-user"), owner, permission, id]),
    ).subarray(0, 5);
    const user = rc4(key, padding);
    for (let index = 1; index < objects.length; index++) {
      const suffix = Buffer.alloc(5);
      suffix.writeUIntLE(index, 0, 3);
      const objectKey = md5(Buffer.concat([key, suffix])).subarray(0, 10);
      const streamAt = objects[index].indexOf("\nstream\n");
      if (streamAt >= 0) {
        const raw = Buffer.from(
          objects[index].slice(
            streamAt + 8,
            objects[index].lastIndexOf("\nendstream"),
          ),
          "latin1",
        );
        // Compress textual streams before encryption, as ordinary encrypted PDFs do.
        const compress = index === 6 || index === 7;
        const cipher = rc4(objectKey, compress ? deflateSync(raw) : raw);
        const dictionary = objects[index]
          .slice(0, streamAt)
          .replace(
            /\/Length \d+/,
            "/Length " +
              cipher.length +
              (compress ? " /Filter /FlateDecode" : ""),
          );
        objects[index] =
          dictionary + "\nstream\n" + cipher.toString("latin1") + "\nendstream";
      } else
        objects[index] = objects[index].replace(
          /\(([^()]*)\)/g,
          (_match, value) =>
            "<" +
            rc4(objectKey, Buffer.from(value, "latin1")).toString("hex") +
            ">",
        );
    }
    objects.push(
      `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P -4 >>`,
    );
  }
  let out = "%PDF-1.7\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out +=
    "xref\n0 " +
    objects.length +
    "\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("");
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R ${encrypted ? `/Encrypt ${objects.length - 1} 0 R /ID [<11223344556677889900112233445566> <11223344556677889900112233445566>]` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
(async () => {
  save("sample.hwp", hwp());
  save("inline.hwp", hwp(1, 5, true));
  save("encrypted.hwp", hwp(3));
  save("distributed.hwp", hwp(5));
  save("old-version.hwp", hwp(1, 4));
  const z = await docx(
    facts.map(p).join("") +
      '<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>' +
      rows
        .map(
          (row) =>
            "<w:tr>" +
            row.map((t) => "<w:tc><w:tcPr/>" + p(t) + "</w:tc>").join("") +
            "</w:tr>",
        )
        .join("") +
      "</w:tbl>",
  );
  save("sample.docx", await z.generateAsync({ type: "nodebuffer" }));
  const h = new JSZip();
  h.file("mimetype", "application/hwp+zip");
  h.file(
    "META-INF/container.xml",
    xml(
      '<container><rootfiles><rootfile full-path="Contents/content.hpf"/></rootfiles></container>',
    ),
  );
  h.file(
    "Contents/content.hpf",
    xml(
      '<opf:package xmlns:opf="http://www.idpf.org/2007/opf"><opf:manifest><opf:item id="section0" href="section0.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="section0"/></opf:spine></opf:package>',
    ),
  );
  const hp = (t) => "<hp:p><hp:run><hp:t>" + t + "</hp:t></hp:run></hp:p>";
  h.file(
    "Contents/section0.xml",
    xml(
      '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">' +
        facts.map(hp).join("") +
        '<hp:p><hp:run><hp:tbl rowCnt="3" colCnt="2">' +
        rows
          .map(
            (row, r) =>
              "<hp:tr>" +
              row
                .map(
                  (t, c) =>
                    '<hp:tc><hp:cellAddr colAddr="' +
                    c +
                    '" rowAddr="' +
                    r +
                    '"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:subList>' +
                    hp(t) +
                    "</hp:subList></hp:tc>",
                )
                .join("") +
              "</hp:tr>",
          )
          .join("") +
        "</hp:tbl></hp:run></hp:p></hs:sec>",
    ),
  );
  save("sample.hwpx", await h.generateAsync({ type: "nodebuffer" }));
  const w = new ExcelJS.Workbook(),
    s = w.addWorksheet("요구사항");
  facts.forEach((f) => s.addRow([f]));
  s.addRow([]);
  rows.forEach((row) => s.addRow(row));
  save("sample.xlsx", Buffer.from(await w.xlsx.writeBuffer()));
  const f = new ExcelJS.Workbook(),
    fs = f.addWorksheet("가격");
  fs.addRow(["금액", "비율"]);
  fs.addRow([1234.5, 0.25]);
  fs.addRow([
    { formula: "A2*2", result: 2469 },
    new Date("2026-09-06T00:00:00Z"),
  ]);
  fs.getCell("A2").numFmt = "#,##0.00";
  fs.getCell("B2").numFmt = "0%";
  fs.getCell("A3").numFmt = "#,##0.00";
  fs.getCell("B3").numFmt = "yyyy-mm-dd";
  f.addWorksheet("숨김", { state: "hidden" }).addRow(["고효율 인증 필수"]);
  save("formatted.xlsx", Buffer.from(await f.xlsx.writeBuffer()));
  const dates = new ExcelJS.Workbook();
  dates.properties.date1904 = true;
  const dateSheet = dates.addWorksheet("날짜");
  dateSheet.addRow(["날짜", "적용"]);
  dateSheet.addRow([new Date("2026-09-06T00:00:00Z"), true]);
  dateSheet.getCell("A2").numFmt = "yyyy-mm-dd hh:mm";
  save("dates-1904.xlsx", Buffer.from(await dates.xlsx.writeBuffer()));
  save("sample.pdf", pdf());
  save("ratio-limit.pdf", pdf(false, false, false, true));
  save("image-only.pdf", pdf(true));
  save("partial.pdf", pdf(false, true));
  save("encrypted.pdf", pdf(false, false, true));
  for (const ext of ["hwp", "hwpx", "pdf", "docx", "xlsx"])
    save("corrupt." + ext, Buffer.from("broken container"));
  const huge = await docx(p("가".repeat(Math.ceil((10 * 1024 * 1024) / 3))));
  save(
    "text-limit.docx",
    await huge.generateAsync({ type: "nodebuffer", compression: "STORE" }),
  );
  const entries = await docx(p("소비전력 50W 이하"));
  for (let i = 0; i < 4097; i++) entries.file("entries/" + i, "");
  save("entry-limit.docx", await entries.generateAsync({ type: "nodebuffer" }));
  const ratio = await docx(p("a".repeat(200000)));
  save(
    "ratio-limit.docx",
    await ratio.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
  const lie = await ratio.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  let off = 0;
  while (off < lie.length - 46) {
    if (
      lie.readUInt32LE(off) === 0x02014b50 &&
      lie.toString("utf8", off + 46, off + 46 + lie.readUInt16LE(off + 28)) ===
        "word/document.xml"
    ) {
      lie.writeUInt32LE(20, off + 24);
      lie.writeUInt32LE(20, lie.readUInt32LE(off + 42) + 22);
      break;
    }
    off++;
  }
  save("lying-size.docx", lie);
})();

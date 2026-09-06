// Synthetic OOXML review regressions. This writes fixtures, never reads parsers.
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const JSZip = require("jszip");
const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const rel =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const p = (text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
async function write(name, body, extra = {}) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${extra.type ?? ""}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="root" Type="${rel}/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<w:document xmlns:w="${w}" xmlns:r="${rel}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr/></w:body></w:document>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${extra.rels ?? ""}</Relationships>`,
  );
  for (const [path, bytes] of Object.entries(extra.files ?? {}))
    zip.file(path, bytes);
  writeFileSync(
    join(__dirname, name),
    await zip.generateAsync({ type: "nodebuffer", compression: "STORE" }),
  );
}
(async () => {
  for (const kind of ["footnote", "endnote"]) {
    const file = `${kind}s.xml`;
    await write(
      `review-${kind}.docx`,
      `<w:p><w:r><w:t>소비전력 50W 이하</w:t><w:${kind}Reference w:id="1"/></w:r></w:p>`,
      {
        type: `<Override PartName="/word/${file}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}s+xml"/>`,
        rels: `<Relationship Id="notes" Type="${rel}/${kind}s" Target="${file}"/>`,
        files: {
          [`word/${file}`]: `<w:${kind}s xmlns:w="${w}"><w:${kind} w:id="1">${p("광효율 130 lm/W 이상")}</w:${kind}></w:${kind}s>`,
        },
      },
    );
  }
  const picture =
    '<w:hyperlink r:id="link"><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="fixture"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="image"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:hyperlink>';
  await write(
    "review-nested-image.docx",
    `<w:p><w:r><w:t>소비전력 50W 이하</w:t></w:r>${picture}</w:p>`,
    {
      rels: `<Relationship Id="image" Type="${rel}/image" Target="media/image.png"/><Relationship Id="link" Type="${rel}/hyperlink" Target="https://example.invalid/" TargetMode="External"/>`,
      files: {
        "word/media/image.png": Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1QAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  );
  await write(
    "review-tabs.docx",
    '<w:p><w:r><w:t>소비전력</w:t><w:tab/><w:t>50W 이하</w:t></w:r></w:p><w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc>' +
      p("항목") +
      "</w:tc><w:tc><w:p><w:r><w:t>광효율</w:t><w:tab/><w:t>130 lm/W 이상</w:t></w:r></w:p></w:tc></w:tr></w:tbl>",
  );
})();

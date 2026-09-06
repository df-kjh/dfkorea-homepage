const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const kst = (value: Date | string) =>
  new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

type DetailRow = [label: string, value: unknown, emailLink?: boolean];
type MailSection = { title: string; rows: DetailRow[] };

// Null/empty fallbacks must not discard numeric zero in stored specifications.
const display = (value: unknown, fallback = "-") =>
  value === null || value === undefined || value === ""
    ? fallback
    : String(value);
const list = (values: unknown[] | undefined, fallback = "-", unit = "") =>
  values?.length
    ? values.map((value) => `${display(value)}${unit}`).join(", ")
    : fallback;
const requestedValue = (value: unknown, unit: string) =>
  value === null || value === undefined ? "상담 후 결정" : `${value}${unit}`;
const htmlValue = (value: unknown) =>
  escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");

function renderSection(section: MailSection) {
  const rows = section.rows
    .map(([label, value, emailLink]) => {
      // Encode address characters before HTML escaping so query/attribute characters
      // in untrusted values cannot change the mailto action or surrounding markup.
      const content = emailLink
        ? `<a href="mailto:${escapeHtml(encodeURIComponent(String(value)))}" style="color:#1d4ed8;text-decoration:underline;word-break:break-all">${htmlValue(value)}</a>`
        : htmlValue(value);
      return `<tr><th scope="row" width="32%" style="width:32%;padding:11px 12px;border:1px solid #dce3eb;background-color:#f5f7fa;text-align:left;vertical-align:top;font-size:13px;font-weight:600;color:#475569;word-wrap:break-word">${escapeHtml(label)}</th><td style="padding:11px 12px;border:1px solid #dce3eb;vertical-align:top;font-size:14px;color:#172033;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;word-break:break-all">${content}</td></tr>`;
    })
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 24px"><caption style="padding:0 0 10px;text-align:left;font-size:17px;font-weight:700;color:#172033">${escapeHtml(section.title)}</caption><tbody>${rows}</tbody></table>`;
}

export function renderQuoteMail(request: any, items: any[], photos: any[]) {
  const company = request.company;
  const sections: MailSection[] = [
    {
      title: "접수 정보",
      rows: [
        ["접수번호", request.reference],
        ["접수시각 (KST)", kst(request.created_at)],
        ["사업자 확인 (KST)", kst(request.verified_at)],
      ],
    },
    {
      title: "기업·회신 정보",
      rows: [
        ["회사명", company.companyName],
        ["사업자등록번호", company.businessNumber],
        ["대표자", company.representativeName],
        ["개업일자", company.openingDate],
        ["담당자", company.contactName],
        ["전화", display(company.phone, "미입력")],
        ["회신 이메일", company.email, true],
      ],
    },
    ...items.map((item, index): MailSection => {
      const snapshot = item.snapshot ?? {};
      const selected = item.selected ?? {};
      const catalog = item.kind === "catalog";
      const rows: DetailRow[] = [
        ["품목명", display(snapshot.name)],
        ["구분", catalog ? "카탈로그" : "직접 입력"],
        ["수량", display(item.quantity)],
      ];
      if (catalog) {
        rows.push(
          ["모델명", display(snapshot.modelName)],
          ["제품 분류", display(snapshot.category)],
          ["등록 규격", display(snapshot.dimensions)],
          ["등록 소비전력", list(snapshot.power, "-", "W")],
          ["등록 색온도", list(snapshot.colorTemp, "-", "K")],
          ["등록 옵션", list(snapshot.options)],
          ["보유 인증", list(snapshot.certifications)],
        );
        if (snapshot.description)
          rows.push(["등록 제품 설명", snapshot.description]);
      } else {
        rows.push(["요청 규격", display(snapshot.dimensions)]);
      }
      rows.push(
        ["희망 소비전력", requestedValue(selected.power, "W")],
        ["희망 색온도", requestedValue(selected.colorTemp, "K")],
        ["희망 옵션", list(selected.options, "상담 후 결정")],
        ["요구 인증", list(selected.certifications)],
        // Custom descriptions are persisted in snapshot; catalog requests use selected.
        [
          "요구 사양",
          display(
            catalog
              ? selected.description
              : snapshot.description || selected.description,
          ),
        ],
        [
          "첨부 사진",
          photos
            .filter((photo) => photo.item_id === item.id)
            .map((photo) => photo.name)
            .join("\n") || "없음",
        ],
      );
      return {
        title: `품목 ${index + 1} · ${catalog ? "카탈로그" : "직접 입력"}`,
        rows,
      };
    }),
    {
      title: "추가 요청·납기",
      rows: [
        ["추가 요청", display(request.notes, "없음")],
        ["희망 납기", display(request.requested_delivery_date, "미정")],
      ],
    },
  ];
  const notices = [
    "제품의 와트·인증 조합 및 실제 공급 가능 여부는 담당자 확인 대상입니다.",
    "이 요청은 사업자 등록정보 일치를 확인한 것으로, 담당자의 재직·대표권·이메일 소유권 인증을 의미하지 않습니다.",
  ];
  // Tables and inline styles support email clients without flex/grid/media-query support.
  // Outlook's Word renderer needs the conditional fixed-width wrapper for max-width.
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DF KOREA 온라인 견적</title></head><body style="margin:0;padding:0;background-color:#eef2f6;font-family:Arial,'Malgun Gothic',sans-serif;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background-color:#eef2f6"><tr><td align="center" style="padding:24px 12px"><!--[if mso]><table role="presentation" width="720" cellpadding="0" cellspacing="0"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:720px;border-collapse:collapse;background-color:#ffffff"><tr><td style="padding:24px 16px 20px;border-top:4px solid #183c65"><p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;color:#64748b">DF KOREA</p><h1 style="margin:0 0 8px;font-size:24px;line-height:1.4;color:#172033">온라인 견적 요청</h1><p style="margin:0;font-size:14px;color:#475569">총 ${items.length}개 품목의 사양과 요청 내용을 확인해 주세요.</p></td></tr><tr><td style="padding:0 16px 8px">${sections.map(renderSection).join("")}</td></tr><tr><td style="padding:16px;background-color:#f5f7fa;border-top:1px solid #dce3eb">${notices.map((notice) => `<p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:#64748b">${escapeHtml(notice)}</p>`).join("")}</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  return {
    to: "kymkjh2002@dfkorealed.com",
    fromName: "DF KOREA 온라인 견적",
    subject: `[온라인 견적][${request.reference}] ${company.companyName.replace(/[\r\n]/g, " ")} · ${items.length}개 품목`,
    html,
    text: [
      "DF KOREA 온라인 견적",
      ...sections.map(
        ({ title, rows }) =>
          `${title}\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}`,
      ),
      ...notices,
    ].join("\n\n"),
  };
}

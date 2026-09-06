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
export function renderQuoteMail(request: any, items: any[], photos: any[]) {
  const company = request.company;
  const details = [
    ["접수번호", request.reference],
    ["접수시각 (KST)", kst(request.created_at)],
    ["사업자 확인 (KST)", kst(request.verified_at)],
    ["회사명", company.companyName],
    ["사업자등록번호", company.businessNumber],
    ["대표자", company.representativeName],
    ["개업일자", company.openingDate],
    ["담당자", company.contactName],
    ["전화", company.phone || "미입력"],
  ];
  const rows = items
    .map((item) => {
      const snapshot = item.snapshot,
        selected = item.selected;
      const lines = [
        `구분: ${item.kind === "catalog" ? "카탈로그" : "직접 입력"}`,
        `모델명: ${snapshot.modelName || "-"}`,
        `수량: ${item.quantity}`,
        `희망 소비전력: ${selected.power === null || selected.power === undefined ? "상담 후 결정" : selected.power + "W"}`,
        `희망 색온도: ${selected.colorTemp === null || selected.colorTemp === undefined ? "상담 후 결정" : selected.colorTemp + "K"}`,
        `규격: ${snapshot.dimensions || "-"}`,
        `희망 옵션: ${selected.options?.join(", ") || "상담 후 결정"}`,
        `보유 인증: ${snapshot.certifications?.join(", ") || "-"}`,
        `요구 인증: ${selected.certifications?.join(", ") || "-"}`,
        `요구 사양: ${snapshot.description || selected.description || "-"}`,
        `첨부 사진: ${
          photos
            .filter((photo) => photo.item_id === item.id)
            .map((photo) => photo.name)
            .join(", ") || "없음"
        }`,
      ];
      return `<tr><td style="padding:12px;border:1px solid #ddd">${escapeHtml(snapshot.name)}</td><td style="padding:12px;border:1px solid #ddd;white-space:pre-wrap">${escapeHtml(lines.join("\n"))}</td></tr>`;
    })
    .join("");
  const html = `<h1>DF KOREA 온라인 견적</h1><dl>${details.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}<dt>회신 이메일</dt><dd><a href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a></dd></dl><table style="border-collapse:collapse"><thead><tr><th>품목</th><th>사양 및 수량</th></tr></thead><tbody>${rows}</tbody></table><p>제품의 와트·인증 조합 및 실제 공급 가능 여부는 담당자 확인 대상입니다.</p><h2>추가 요청</h2><p style="white-space:pre-wrap">${escapeHtml(request.notes || "없음")}</p><p>희망 납기: ${escapeHtml(request.requested_delivery_date || "미정")}</p><p>이 요청은 사업자 등록정보 일치를 확인한 것으로, 담당자의 재직·대표권·이메일 소유권 인증을 의미하지 않습니다.</p>`;
  return {
    to: "kymkjh2002@dfkorealed.com",
    fromName: "DF KOREA 온라인 견적",
    subject: `[온라인 견적][${request.reference}] ${company.companyName.replace(/[\r\n]/g, " ")} · ${items.length}개 품목`,
    html,
    text: details.map(([label, value]) => `${label}: ${value}`).join("\n"),
  };
}

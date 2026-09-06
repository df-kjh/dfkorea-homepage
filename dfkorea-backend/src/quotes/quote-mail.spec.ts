import { renderQuoteMail } from "./quote-mail";
describe("quote email snapshots", () => {
  it("escapes all visitor content, labels requested certification separately and includes photo/item mapping", () => {
    const mail = renderQuoteMail(
      {
        reference: "Q-123",
        created_at: new Date(),
        verified_at: new Date(),
        company: {
          companyName: "<script>bad</script>",
          businessNumber: "1234567890",
          representativeName: "대표",
          openingDate: "2020-01-01",
          contactName: "담당",
          email: "person@example.com",
        },
        notes: "<img src=x>",
        requested_delivery_date: null,
      },
      [
        {
          id: "i",
          kind: "catalog",
          quantity: 5,
          snapshot: {
            name: "제품",
            modelName: "MODEL",
            certifications: ["KC"],
          },
          selected: { certifications: ["고효율"], options: [] },
        },
      ],
      [{ item_id: "i", name: "photo.jpg" }],
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("요구 인증");
    expect(mail.html).toContain("보유 인증");
    expect(mail.html).toContain("photo.jpg");
    expect(mail.to).toBe("kymkjh2002@dfkorealed.com");
    expect(mail.fromName).toBe("DF KOREA 온라인 견적");
  });
});

const request = {
  reference: "Q-20260906-DEMO",
  created_at: "2026-09-06T00:30:00.000Z",
  verified_at: "2026-09-06T00:20:00.000Z",
  company: {
    companyName: "예시조명\n주식회사",
    businessNumber: "0000000000",
    representativeName: "예시 대표",
    openingDate: "2020-01-01",
    contactName: "예시 담당",
    phone: "02-0000-0000",
    email: "quote@example.com",
  },
  notes: "1층 설치\n야간 작업 요청",
  requested_delivery_date: "2026-10-15",
};
const items = [
  {
    id: "catalog-1",
    kind: "catalog",
    quantity: 12,
    snapshot: {
      name: "예시 평판등",
      modelName: "DEMO-40",
      category: "실내조명",
      dimensions: "600 × 600 × 25 mm",
      power: [40, 50],
      colorTemp: [3000, 4000],
      certifications: ["KC"],
      options: ["디밍", "센서"],
      description: "등록된 제품 설명",
    },
    selected: {
      power: 40,
      colorTemp: 4000,
      certifications: ["고효율"],
      options: ["디밍"],
      description: "기존 천장에 맞춰 설치",
    },
  },
  {
    id: "custom-1",
    kind: "custom",
    quantity: 3,
    snapshot: {
      name: "예시 주문 제작등",
      dimensions: "1200 × 300 mm",
      description: "방수형\n케이블 2 m",
    },
    selected: { power: null, colorTemp: null, options: [], certifications: [] },
  },
];
const photos = [
  { item_id: "catalog-1", name: "천장.jpg" },
  { item_id: "custom-1", name: "도면.png" },
  { item_id: "custom-1", name: "현장.jpg" },
];

// Inspect actual rendered data rows, so labels outside tables or item/photo mixing fail.
const dataTables = (html: string) =>
  html.match(/<table\b[^>]*>\s*<caption\b[\s\S]*?<\/table>/g) || [];
const expectRow = (table: string, label: string, value: string) => {
  const row = table
    .match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)
    ?.find((row) => row.includes(`>${label}</th>`));
  expect(row).toBeDefined();
  expect(row).toContain(value);
};

describe("readable quote email", () => {
  it("puts receipt and all reply details in labeled tables and keeps delivery metadata", () => {
    const mail = renderQuoteMail(request, items, photos);
    const tables = dataTables(mail.html);
    expect(tables).toHaveLength(5);
    expectRow(tables[0], "접수번호", "Q-20260906-DEMO");
    expectRow(tables[0], "접수시각 (KST)", "오전 9:30:00");
    expectRow(tables[0], "사업자 확인 (KST)", "오전 9:20:00");
    expectRow(tables[1], "회사명", "예시조명<br>주식회사");
    expectRow(tables[1], "사업자등록번호", "0000000000");
    expectRow(tables[1], "대표자", "예시 대표");
    expectRow(tables[1], "개업일자", "2020-01-01");
    expectRow(tables[1], "담당자", "예시 담당");
    expectRow(tables[1], "전화", "02-0000-0000");
    expectRow(tables[1], "회신 이메일", "quote@example.com");
    expectRow(tables[4], "추가 요청", "1층 설치<br>야간 작업 요청");
    expectRow(tables[4], "희망 납기", "2026-10-15");
    expect(mail.subject).toBe(
      "[온라인 견적][Q-20260906-DEMO] 예시조명 주식회사 · 2개 품목",
    );
    expect(mail.to).toBe("kymkjh2002@dfkorealed.com");
    expect(mail.fromName).toBe("DF KOREA 온라인 견적");
  });

  it("separates registered and requested specs without dropping custom details or photo ownership", () => {
    const tables = dataTables(renderQuoteMail(request, items, photos).html);
    expect(tables).toHaveLength(5);
    expectRow(tables[2], "품목명", "예시 평판등");
    expectRow(tables[2], "수량", "12");
    expectRow(tables[2], "등록 소비전력", "40W, 50W");
    expectRow(tables[2], "희망 소비전력", "40W");
    expectRow(tables[2], "등록 색온도", "3000K, 4000K");
    expectRow(tables[2], "희망 색온도", "4000K");
    expectRow(tables[2], "등록 옵션", "디밍, 센서");
    expectRow(tables[2], "희망 옵션", "디밍");
    expectRow(tables[2], "보유 인증", "KC");
    expectRow(tables[2], "요구 인증", "고효율");
    expectRow(tables[2], "등록 제품 설명", "등록된 제품 설명");
    expectRow(tables[2], "요구 사양", "기존 천장에 맞춰 설치");
    expectRow(tables[2], "첨부 사진", "천장.jpg");
    expect(tables[2]).not.toContain("도면.png");
    expectRow(tables[3], "요청 규격", "1200 × 300 mm");
    expectRow(tables[3], "요구 사양", "방수형<br>케이블 2 m");
    expectRow(tables[3], "첨부 사진", "도면.png<br>현장.jpg");
    expect(tables[3]).not.toContain("천장.jpg");
  });

  it("includes every meaningful section in the plain text alternative", () => {
    const { text } = renderQuoteMail(request, items, photos);
    for (const detail of [
      "회신 이메일: quote@example.com",
      "품목명: 예시 평판등",
      "수량: 12",
      "등록 소비전력: 40W, 50W",
      "희망 소비전력: 40W",
      "등록 색온도: 3000K, 4000K",
      "희망 색온도: 4000K",
      "등록 옵션: 디밍, 센서",
      "희망 옵션: 디밍",
      "보유 인증: KC",
      "요구 인증: 고효율",
      "등록 제품 설명: 등록된 제품 설명",
      "요구 사양: 기존 천장에 맞춰 설치",
      "첨부 사진: 천장.jpg",
      "품목명: 예시 주문 제작등",
      "요청 규격: 1200 × 300 mm",
      "요구 사양: 방수형\n케이블 2 m",
      "첨부 사진: 도면.png\n현장.jpg",
      "추가 요청: 1층 설치\n야간 작업 요청",
      "희망 납기: 2026-10-15",
      "제품의 와트·인증 조합 및 실제 공급 가능 여부는 담당자 확인 대상입니다.",
      "이메일 소유권 인증을 의미하지 않습니다.",
    ])
      expect(text).toContain(detail);
  });

  it("escapes hostile content in every section and preserves long values and line breaks", () => {
    const hostile = `\"><img src=x onerror='bad()'>&`;
    const escaped = "&quot;&gt;&lt;img src=x onerror=&#39;bad()&#39;&gt;&amp;";
    const longName = "LONG".repeat(100);
    const mail = renderQuoteMail(
      {
        ...request,
        reference: hostile,
        company: { ...request.company, email: hostile, companyName: hostile },
        notes: hostile + "\r\n다음 줄",
      },
      [
        {
          ...items[0],
          snapshot: {
            ...items[0].snapshot,
            name: longName,
            modelName: hostile,
            options: [hostile],
          },
          selected: { ...items[0].selected, description: hostile },
        },
      ],
      [{ item_id: "catalog-1", name: hostile }],
    );
    expect(mail.html).not.toMatch(/<img|<script|onerror=['"]bad/);
    expect(mail.html).toContain(escaped);
    expect(mail.html).toContain(`${escaped}<br>다음 줄`);
    expect(mail.html).toContain(longName);
    expect(mail.html).toContain("word-break:break-all");
    expect(mail.text).toContain(hostile);
    expect(mail.text).toContain(longName);
  });

  it("keeps zero specifications and supplies readable defaults for omitted values", () => {
    const mail = renderQuoteMail(
      {
        ...request,
        company: { ...request.company, phone: "" },
        notes: null,
        requested_delivery_date: null,
      },
      [
        {
          id: "zero",
          kind: "custom",
          quantity: 0,
          snapshot: { name: "0", dimensions: 0 },
          selected: { power: 0, colorTemp: 0 },
        },
      ],
      [],
    );
    const tables = dataTables(mail.html);
    expect(tables).toHaveLength(4);
    expectRow(tables[1], "전화", "미입력");
    expectRow(tables[2], "수량", ">0</td>");
    expectRow(tables[2], "요청 규격", ">0</td>");
    expectRow(tables[2], "희망 소비전력", "0W");
    expectRow(tables[2], "희망 색온도", "0K");
    expectRow(tables[2], "희망 옵션", "상담 후 결정");
    expectRow(tables[2], "첨부 사진", "없음");
    expectRow(tables[3], "추가 요청", "없음");
    expectRow(tables[3], "희망 납기", "미정");
    expect(mail.html).not.toMatch(/undefined|\[object Object\]|NaN/);
  });
});

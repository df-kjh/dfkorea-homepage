export interface LhListRow {
  workTypeCode: string;
  sourceNoticeId: string;
  revision: string;
  title: string;
  bidEndedAt: Date | null;
  orderingOrganization: string;
  emergencyOrder: string;
  detailPath: string;
}

export interface LhListPage {
  rows: LhListRow[];
  totalPages: number;
}

export interface LhAttachment {
  sequence: string;
  displayName: string;
  savedName: string;
}

export interface LhTenderDetail {
  registeredAt: Date;
  orderingOrganization: string;
  demandOrganization: string | null;
  contractMethod: string | null;
  bidStartedAt: Date | null;
  bidEndedAt: Date;
  openedAt: Date | null;
  basisAmount: string | null;
  region: string | null;
  attachments: LhAttachment[];
}

const REQUIRED_LIST_HEADERS = [
  "업무구분",
  "공고번호",
  "공고차수",
  "공고명",
  "입찰마감일시",
  "공고기관",
  "긴급입찰",
] as const;

const REQUIRED_DETAIL_LABELS = ["공고일", "발주기관", "입찰마감일시"] as const;

export class LhHtmlStructureError extends Error {
  constructor() {
    super("LH tender HTML structure changed");
    this.name = "LhHtmlStructureError";
  }
}

export const parseLhListPage = (
  html: string,
  workTypeCode: string,
): LhListPage => {
  const table = requiredTable(html, "bidMasterList");
  const rows = tableRows(table);
  const header = rows.shift();
  if (!header) throw new LhHtmlStructureError();
  const columnByHeader = new Map(
    header.map((cell, index) => [plainText(cell), index]),
  );
  if (REQUIRED_LIST_HEADERS.some((name) => !columnByHeader.has(name))) {
    throw new LhHtmlStructureError();
  }

  const totalPages = attributeValue(
    requiredElement(html, "pagination"),
    "data-total-pages",
  );
  const totalPagesNumber = totalPages === null ? NaN : Number(totalPages);
  if (
    !Number.isSafeInteger(totalPagesNumber) ||
    totalPagesNumber < 1 ||
    totalPagesNumber > 10_000
  ) {
    throw new LhHtmlStructureError();
  }

  return {
    totalPages: totalPagesNumber,
    rows: rows.map((cells) => {
      const value = (name: (typeof REQUIRED_LIST_HEADERS)[number]) => {
        const index = columnByHeader.get(name);
        const cell = index === undefined ? null : cells[index];
        const text =
          cell === undefined || cell === null ? null : plainText(cell);
        if (!text) throw new LhHtmlStructureError();
        return text;
      };
      const titleCell = cells[columnByHeader.get("공고명")!];
      const detailPath = titleCell === undefined ? null : linkPath(titleCell);
      if (
        !detailPath ||
        !detailPath.startsWith("/") ||
        detailPath.startsWith("//")
      ) {
        throw new LhHtmlStructureError();
      }
      return {
        workTypeCode,
        sourceNoticeId: value("공고번호"),
        revision: value("공고차수"),
        title: value("공고명"),
        bidEndedAt: parseLhDate(value("입찰마감일시")),
        orderingOrganization: value("공고기관"),
        emergencyOrder: value("긴급입찰"),
        detailPath,
      };
    }),
  };
};

export const parseLhTenderDetail = (html: string): LhTenderDetail => {
  const fields = new Map<string, string>();
  for (const row of tableRows(requiredTable(html, "bidDetail"))) {
    const [label, value] = row;
    const normalizedLabel = label === undefined ? "" : plainText(label);
    const normalizedValue = value === undefined ? "" : plainText(value);
    if (normalizedLabel && normalizedValue)
      fields.set(normalizedLabel, normalizedValue);
  }
  if (REQUIRED_DETAIL_LABELS.some((name) => !fields.get(name))) {
    throw new LhHtmlStructureError();
  }

  const registeredAt = parseLhDate(fields.get("공고일")!);
  const bidEndedAt = parseLhDate(fields.get("입찰마감일시")!);
  if (!registeredAt || !bidEndedAt) throw new LhHtmlStructureError();

  const attachmentTable = tableById(html, "attachmentList");
  return {
    registeredAt,
    orderingOrganization: fields.get("발주기관")!,
    demandOrganization: nullableField(fields.get("수요기관")),
    contractMethod: nullableField(fields.get("계약방법")),
    bidStartedAt: parseOptionalLhDate(fields.get("입찰개시일시")),
    bidEndedAt,
    openedAt: parseOptionalLhDate(fields.get("개찰일시")),
    basisAmount: normalizeAmount(fields.get("기초금액")),
    region: nullableField(fields.get("납품지역")),
    attachments: attachmentTable ? parseAttachments(attachmentTable) : [],
  };
};

const parseAttachments = (table: string): LhAttachment[] => {
  const rows = tableRows(table);
  const header = rows.shift();
  if (!header) throw new LhHtmlStructureError();
  const columns = new Map(
    header.map((cell, index) => [plainText(cell), index]),
  );
  for (const name of ["순번", "첨부파일명", "저장파일명"]) {
    if (!columns.has(name)) throw new LhHtmlStructureError();
  }
  return rows.map((cells) => {
    const value = (name: string) => {
      const cell = cells[columns.get(name)!];
      const text = cell === undefined ? "" : plainText(cell);
      if (!text) throw new LhHtmlStructureError();
      return text;
    };
    return {
      sequence: value("순번"),
      displayName: value("첨부파일명"),
      savedName: value("저장파일명"),
    };
  });
};

const requiredTable = (html: string, id: string): string => {
  const table = tableById(html, id);
  if (!table) throw new LhHtmlStructureError();
  return table;
};

const tableById = (html: string, id: string): string | null => {
  const escapedId = escapeRegExp(id);
  const match = html.match(
    new RegExp(
      `<table\\b[^>]*\\bid\\s*=\\s*(["'])${escapedId}\\1[^>]*>([\\s\\S]*?)<\\/table>`,
      "i",
    ),
  );
  return match?.[2] ?? null;
};

const requiredElement = (html: string, id: string): string => {
  const escapedId = escapeRegExp(id);
  const match = html.match(
    new RegExp(`<[^>]+\\bid\\s*=\\s*(["'])${escapedId}\\1[^>]*>`, "i"),
  );
  if (!match) throw new LhHtmlStructureError();
  return match[0];
};

const tableRows = (table: string): string[][] =>
  Array.from(table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) =>
    Array.from(
      match[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi),
    ).map((cell) => cell[1]),
  );

const linkPath = (cell: string): string | null => {
  const match = cell.match(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/i);
  return match?.[2] ? decodeHtml(match[2]).trim() : null;
};

const attributeValue = (element: string, name: string): string | null => {
  const match = element.match(
    new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(["'])(.*?)\\1`, "i"),
  );
  return match?.[2] ? decodeHtml(match[2]).trim() : null;
};

const plainText = (value: string): string =>
  decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");

const nullableField = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized || null;
};

const parseOptionalLhDate = (value: string | undefined): Date | null =>
  value ? parseLhDate(value) : null;

export const parseLhDate = (value: string): Date | null => {
  const match = value.match(
    /^(\d{4})\.(\d{2})\.(\d{2})(?:\s+(\d{2}):(\d{2}))?$/,
  );
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  const localEpoch = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const local = new Date(localEpoch);
  return local.getUTCFullYear() === Number(year) &&
    local.getUTCMonth() === Number(month) - 1 &&
    local.getUTCDate() === Number(day) &&
    local.getUTCHours() === Number(hour) &&
    local.getUTCMinutes() === Number(minute)
    ? new Date(localEpoch - 9 * 60 * 60 * 1_000)
    : null;
};

const normalizeAmount = (value: string | undefined): string | null => {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits || null;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

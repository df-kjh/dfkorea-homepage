export interface LhListRow {
  workTypeCode: "30" | "40";
  sourceNoticeId: string;
  revision: string;
  title: string;
  bidEndedAt: Date | null;
  orderingOrganization: string;
  emergencyOrder: "N" | "Y";
  detailPath: string;
}

export interface LhListPage {
  rows: LhListRow[];
  nextTargetRow: string | null;
}

export interface LhAttachment {
  sequence: string;
  displayName: string;
  savedName: string;
}

export interface LhTenderDetail {
  registeredAt: Date;
  orderingOrganization: string;
  demandOrganization: null;
  contractMethod: string;
  bidStartedAt: Date;
  bidEndedAt: Date;
  openedAt: Date;
  basisAmount: string | null;
  region: string | null;
  attachments: LhAttachment[];
}

interface HtmlRow {
  attributes: string;
  cells: string[];
}

const REQUIRED_LIST_HEADERS = [
  "공고번호",
  "업무",
  "분류",
  "입찰건명",
  "계약방법",
  "입찰마감일자",
  "지역본부",
  "현황",
] as const;

const WORK_TYPE_BY_LABEL: Record<string, "30" | "40"> = {
  물품: "30",
  지급자재: "40",
};

const DETAIL_PATH_BY_WORK_TYPE: Record<"30" | "40", string> = {
  "30": "/ebid.et.tp.cmd.BidgdsDetailListCmd.dev",
  "40": "/ebid.et.tp.cmd.BidctrctgdsDetailListCmd.dev",
};

export class LhHtmlStructureError extends Error {
  constructor() {
    super("LH tender HTML structure changed");
    this.name = "LhHtmlStructureError";
  }
}

export const parseLhListPage = (
  html: string,
  requestedWorkTypeCode: "30" | "40",
): LhListPage => {
  const rows = tableRows(requiredTableBySummary(html, "목록정보"));
  const header = rows.shift();
  if (!header) throw new LhHtmlStructureError();
  const columnByHeader = new Map(
    header.cells.map((cell, index) => [plainText(cell), index]),
  );
  if (REQUIRED_LIST_HEADERS.some((name) => !columnByHeader.has(name))) {
    throw new LhHtmlStructureError();
  }

  return {
    rows: rows.map((row) => {
      const value = (name: (typeof REQUIRED_LIST_HEADERS)[number]) => {
        const index = columnByHeader.get(name);
        const text =
          index === undefined ? "" : plainText(row.cells[index] ?? "");
        if (!text) throw new LhHtmlStructureError();
        return text;
      };
      const workTypeCode = WORK_TYPE_BY_LABEL[value("업무")];
      if (!workTypeCode || workTypeCode !== requestedWorkTypeCode) {
        throw new LhHtmlStructureError();
      }
      const identity = parseOpenArguments(
        attributeValue(row.attributes, "onclick"),
      );
      const sourceNoticeId = value("공고번호");
      if (
        identity.bidNum !== sourceNoticeId ||
        identity.workTypeCode !== workTypeCode
      ) {
        throw new LhHtmlStructureError();
      }
      return {
        workTypeCode,
        sourceNoticeId,
        revision: identity.revision,
        title: value("입찰건명"),
        bidEndedAt: parseLhDate(value("입찰마감일자")),
        orderingOrganization: value("지역본부"),
        emergencyOrder: identity.emergencyOrder,
        detailPath: canonicalLhDetailPath(identity),
      };
    }),
    nextTargetRow: nextTargetRow(html),
  };
};

export const parseLhTenderDetail = (
  html: string,
  expectedNoticeId: string,
): LhTenderDetail => {
  const general = labelValues(requiredTableBySummary(html, "공고일반정보"));
  const contract = labelValues(
    requiredTableBySummary(html, "계약및입찰방식정보"),
  );
  const progress = labelValues(requiredTableBySummary(html, "입찰진행정보"));
  const files = requiredTableBySummary(html, "파일정보");
  const requiredGeneral = ["입찰공고번호", "입찰공고일", "공고부서"];
  const requiredProgress = [
    "입찰서접수개시일시",
    "입찰서접수마감일시",
    "개찰일시",
    "기초금액",
  ];
  if (
    requiredGeneral.some((label) => !general.get(label)) ||
    !contract.get("계약방법") ||
    requiredProgress.some((label) => !progress.get(label)) ||
    general.get("입찰공고번호") !== expectedNoticeId
  ) {
    throw new LhHtmlStructureError();
  }

  const registeredAt = parseLhDate(general.get("입찰공고일")!);
  const bidStartedAt = parseLhDate(progress.get("입찰서접수개시일시")!);
  const bidEndedAt = parseLhDate(progress.get("입찰서접수마감일시")!);
  const openedAt = parseLhDate(progress.get("개찰일시")!);
  if (!registeredAt || !bidStartedAt || !bidEndedAt || !openedAt) {
    throw new LhHtmlStructureError();
  }

  return {
    registeredAt,
    orderingOrganization: general.get("공고부서")!,
    demandOrganization: null,
    contractMethod: contract.get("계약방법")!,
    bidStartedAt,
    bidEndedAt,
    openedAt,
    basisAmount: normalizeAmount(progress.get("기초금액")),
    region: nullableField(general.get("납품지역")),
    attachments: parseAttachments(files),
  };
};

const parseAttachments = (table: string): LhAttachment[] =>
  tableRows(table).flatMap((row) => {
    const match = row.cells
      .join(" ")
      .match(
        /javascript:\s*fn_dds_open\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*\)/i,
      );
    if (!match) return [];
    const [, sequence, savedName, clientPath, displayName] = match;
    if (!clientPath.startsWith("/attachEBID/bidinfo/")) {
      throw new LhHtmlStructureError();
    }
    return [{ sequence, displayName, savedName }];
  });

const parseOpenArguments = (
  value: string | null,
): {
  bidNum: string;
  revision: string;
  workTypeCode: "30" | "40";
  emergencyOrder: "N" | "Y";
} => {
  const match = value?.match(
    /^\s*fn_dds_open\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'(30|40)'\s*,\s*'([NY])'\s*\)\s*;?\s*$/,
  );
  if (!match) throw new LhHtmlStructureError();
  const [, bidNum, revision, workTypeCode, emergencyOrder] = match;
  return {
    bidNum,
    revision,
    workTypeCode: workTypeCode as "30" | "40",
    emergencyOrder: emergencyOrder as "N" | "Y",
  };
};

const canonicalLhDetailPath = (identity: {
  bidNum: string;
  revision: string;
  workTypeCode: "30" | "40";
  emergencyOrder: "N" | "Y";
}): string => {
  const query = new URLSearchParams({
    bidNum: identity.bidNum,
    bidDegree: identity.revision,
    cstrtnJobGbCd: identity.workTypeCode,
    emrgncyOrder: identity.emergencyOrder,
  });
  return `${DETAIL_PATH_BY_WORK_TYPE[identity.workTypeCode]}?${query.toString()}`;
};

const nextTargetRow = (html: string): string | null => {
  const current = attributeValue(requiredInput(html, "targetRow"), "value");
  if (!current || !isTargetRow(current)) throw new LhHtmlStructureError();
  const offsets = Array.from(
    html.matchAll(/<option\b[^>]*\bvalue\s*=\s*(["'])(\d+)\1[^>]*>/gi),
  )
    .map((match) => match[2])
    .filter(isTargetRow)
    .map(Number)
    .filter((offset) => offset > Number(current))
    .sort((left, right) => left - right);
  return offsets.length === 0 ? null : String(offsets[0]);
};

const isTargetRow = (value: string): boolean =>
  /^(?:[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value));

const labelValues = (table: string): Map<string, string> => {
  const values = new Map<string, string>();
  for (const row of tableRows(table)) {
    const label = plainText(row.cells[0] ?? "");
    const value = plainText(row.cells[1] ?? "");
    if (label && value) values.set(label, value);
  }
  return values;
};

const requiredTableBySummary = (html: string, summary: string): string => {
  const escaped = escapeRegExp(summary);
  const match = html.match(
    new RegExp(
      `<table\\b[^>]*\\bsummary\\s*=\\s*(["'])${escaped}\\1[^>]*>([\\s\\S]*?)<\\/table>`,
      "i",
    ),
  );
  if (!match) throw new LhHtmlStructureError();
  return match[2];
};

const requiredInput = (html: string, name: string): string => {
  const match = html.match(
    new RegExp(
      `<input\\b[^>]*\\bname\\s*=\\s*(["'])${escapeRegExp(name)}\\1[^>]*>`,
      "i",
    ),
  );
  if (!match) throw new LhHtmlStructureError();
  return match[0];
};

const tableRows = (table: string): HtmlRow[] =>
  Array.from(table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)).map(
    (match) => ({
      attributes: match[1],
      cells: Array.from(
        match[2].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi),
      ).map((cell) => cell[1]),
    }),
  );

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

export const parseLhDate = (value: string): Date | null => {
  const match = value.match(
    /^(\d{4})[./](\d{2})[./](\d{2})(?:\s+(\d{2}):(\d{2}))?$/,
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

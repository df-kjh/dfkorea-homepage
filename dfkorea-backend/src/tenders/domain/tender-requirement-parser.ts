import {
  EvidenceRef,
  TenderEnrichment,
  TenderLicenseRequirement,
  TenderRegionRequirement,
} from "./tender-enrichment";
import {
  fingerprint,
  ParsedTenderRequirements,
  TenderBidFormula,
  TenderCertificationRequirement,
  TenderComparator,
  TenderParticipationRequirement,
  TenderProcurementItemRequirements,
  TenderRequirementDocument,
  TenderRequirementEvidence,
  TenderSpecificationKind,
  TenderSpecificationRequirement,
  TenderSpecificationUnit,
  TENDER_REGION_CODE_BY_NAME,
} from "./tender-requirement";

const DECIMAL = "([+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)";
const OBLIGATION =
  /(?:필수|하여야|해야|요함|제출|보유|등록|제한|참가할\s*수|업체만|이상|이하|초과|미만)/;
const NEGATED_OBLIGATION =
  /(?:필수(?:가|는|은)?\s*(?:아니|아닙|아님)|요구하지\s*않|하지\s*않아도|불필요)/;

const splitClauses = (text: string): string[] => {
  const clauses: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const decimalPoint =
      character === "." &&
      /\d/.test(text[index - 1] ?? "") &&
      /\d/.test(text[index + 1] ?? "");
    const thousandsSeparator =
      character === "," &&
      /\d/.test(text[index - 1] ?? "") &&
      /\d/.test(text[index + 1] ?? "");
    if (
      character === "\n" ||
      character === "。" ||
      (character === "." && !decimalPoint) ||
      (character === "," && !thousandsSeparator)
    ) {
      const clause = text.slice(start, index).trim();
      if (clause) clauses.push(clause);
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) clauses.push(tail);
  return clauses;
};

const splitRequirementSpans = (text: string): string[] =>
  splitClauses(text).flatMap((clause) =>
    clause
      .split(/\s+(?:및|그리고)\s+|;|(?:이며|이고|하며|하되)\s*/)
      .map((span) => span.trim())
      .filter(Boolean),
  );

const isNegatedObligation = (text: string): boolean =>
  NEGATED_OBLIGATION.test(text);

const isExplicitObligation = (text: string): boolean =>
  OBLIGATION.test(text) && !isNegatedObligation(text);

const comparatorOf = (word: string | undefined): TenderComparator => {
  switch (word) {
    case "이상":
      return "GTE";
    case "이하":
      return "LTE";
    case "초과":
      return "GT";
    case "미만":
      return "LT";
    default:
      return "EQ";
  }
};

const decimal = (value: string): string => {
  const normalized = value.replace(/,/g, "").replace(/^\+/, "");
  const [integer, fraction = ""] = normalized.split(".");
  const sign = integer.startsWith("-") ? "-" : "";
  const digits = integer.replace(/^[+-]/, "").replace(/^0+(?=\d)/, "") || "0";
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${sign}${digits}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
};

const makeSpecification = (
  itemKey: string,
  evidenceId: string,
  kind: TenderSpecificationKind,
  unit: TenderSpecificationUnit,
  comparator: TenderComparator,
  value: string | string[],
  required: boolean,
  sourcePriority: "STRUCTURED" | "DOCUMENT",
): TenderSpecificationRequirement => {
  const normalized = {
    itemKey,
    kind,
    unit,
    comparator,
    ...(Array.isArray(value) ? { values: value } : { value }),
    required,
    evidenceIds: [evidenceId],
    sourcePriority,
  };
  return { id: fingerprint(normalized), ...normalized };
};

interface UnitRule {
  kind: TenderSpecificationKind;
  unit: TenderSpecificationUnit;
  pattern: RegExp;
}

const unitRules: UnitRule[] = [
  {
    kind: "POWER",
    unit: "W",
    pattern: new RegExp(
      `(?:소비\\s*전력|정격\\s*전력)\\s*[:：]?\\s*${DECIMAL}\\s*(?:W|와트)\\s*(이상|이하|초과|미만)?`,
      "gi",
    ),
  },
  {
    kind: "LUMINOUS_EFFICACY",
    unit: "LM_PER_W",
    pattern: new RegExp(
      `(?:광효율|발광\\s*효율)\\s*[:：]?\\s*${DECIMAL}\\s*(?:lm\\s*\\/\\s*W|루멘\\s*\\/\\s*와트)\\s*(이상|이하|초과|미만)?`,
      "gi",
    ),
  },
  {
    kind: "COLOR_TEMPERATURE",
    unit: "K",
    pattern: new RegExp(
      `(?:색\\s*온도|상관\\s*색온도)\\s*[:：]?\\s*${DECIMAL}\\s*(?:K|켈빈)\\s*(이상|이하|초과|미만)?`,
      "gi",
    ),
  },
  {
    kind: "IP_RATING",
    unit: "IP",
    pattern: /(?:보호\s*등급\s*)?IP\s*(\d{2})\s*(이상|이하|초과|미만)?/gi,
  },
  {
    kind: "CRI",
    unit: "CRI",
    pattern: new RegExp(
      `(?:연색성|연색\\s*지수)\\s*(?:CRI|Ra)?\\s*[:：]?\\s*${DECIMAL}\\s*(이상|이하|초과|미만)?`,
      "gi",
    ),
  },
];

const DIMENSION_PATTERN_SOURCE =
  `(?:외형\\s*)?(?:치수|크기|규격)\\s*[:：]?\\s*${DECIMAL}` +
  `\\s*[x×X＊*]\\s*${DECIMAL}\\s*[x×X＊*]\\s*${DECIMAL}` +
  `\\s*(?:mm|밀리미터)\\s*(이상|이하|초과|미만)?`;

interface TextRange {
  start: number;
  end: number;
}

const matchingRanges = (text: string, pattern: RegExp): TextRange[] => {
  const flags = [...new Set(`${pattern.flags}g`)].join("");
  return [...text.matchAll(new RegExp(pattern.source, flags))].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
};

export const parseUnitSpecifications = (
  text: string,
  itemKey: string,
  evidenceId: string,
  sourcePriority: "STRUCTURED" | "DOCUMENT" = "DOCUMENT",
): TenderSpecificationRequirement[] => {
  const results: Array<{
    index: number;
    requirement: TenderSpecificationRequirement;
  }> = [];
  const dimensionPattern = new RegExp(DIMENSION_PATTERN_SOURCE, "gi");
  let clauseOffset = 0;
  for (const clause of splitRequirementSpans(text)) {
    const negated = isNegatedObligation(clause);
    dimensionPattern.lastIndex = 0;
    for (const match of clause.matchAll(dimensionPattern)) {
      const comparator = comparatorOf(match[4]);
      results.push({
        index: clauseOffset + (match.index ?? 0),
        requirement: makeSpecification(
          itemKey,
          evidenceId,
          "DIMENSIONS",
          "MM",
          comparator,
          [decimal(match[1]), decimal(match[2]), decimal(match[3])],
          !negated && (comparator !== "EQ" || isExplicitObligation(clause)),
          sourcePriority,
        ),
      });
    }
    for (const rule of unitRules) {
      rule.pattern.lastIndex = 0;
      for (const match of clause.matchAll(rule.pattern)) {
        const comparator = comparatorOf(match[2]);
        results.push({
          index: clauseOffset + (match.index ?? 0),
          requirement: makeSpecification(
            itemKey,
            evidenceId,
            rule.kind,
            rule.unit,
            comparator,
            decimal(match[1]),
            !negated && (comparator !== "EQ" || isExplicitObligation(clause)),
            sourcePriority,
          ),
        });
      }
    }
    clauseOffset += clause.length + 1;
  }
  return results
    .sort((left, right) =>
      left.index === right.index
        ? left.requirement.kind.localeCompare(right.requirement.kind)
        : left.index - right.index,
    )
    .map(({ requirement }) => requirement);
};

const CERTIFICATION_ALIASES = [
  {
    code: "HIGH_EFFICIENCY",
    name: "고효율에너지기자재 인증",
    pattern: /고효율\s*(?:에너지\s*)?기자재(?:\s*인증)?/i,
  },
  {
    code: "ECO_LABEL",
    name: "환경표지 인증",
    pattern: /환경\s*표지(?:\s*인증)?/i,
  },
  { code: "V_CHECK", name: "V-CHECK", pattern: /V[\s-]?CHECK(?:\s*마크)?/i },
  { code: "KC", name: "KC 인증", pattern: /KC(?:\s*(?:안전)?인증)?/i },
  {
    code: "KS",
    name: "KS 인증",
    pattern: /(?:한국산업표준\s*\(\s*KS\s*\)|KS)(?:\s*인증)?/i,
  },
] as const;

interface CertificationMatch {
  code: (typeof CERTIFICATION_ALIASES)[number]["code"];
  name: (typeof CERTIFICATION_ALIASES)[number]["name"];
  index: number;
  length: number;
}

const certificationMatches = (text: string): CertificationMatch[] =>
  CERTIFICATION_ALIASES.flatMap(({ code, name, pattern }) =>
    matchingRanges(text, pattern).map(({ start, end }) => ({
      code,
      name,
      index: start,
      length: end - start,
    })),
  ).sort(
    (left, right) => left.index - right.index || right.length - left.length,
  );

export const normalizeCertificationAlias = (
  value: string,
): { code: string; name: string } | null => {
  const alias = CERTIFICATION_ALIASES.find(({ pattern }) =>
    pattern.test(value),
  );
  return alias ? { code: alias.code, name: alias.name } : null;
};

const requirementId = (
  requirement: Omit<TenderParticipationRequirement, "id">,
): TenderParticipationRequirement => ({
  id: fingerprint(requirement),
  ...requirement,
});

const koreanAmount = (value: string, unit: string | undefined): string => {
  const multiplier =
    unit === "억" ? 100_000_000n : unit === "만" ? 10_000n : 1n;
  const normalized = decimal(value);
  const [integer, fraction = ""] = normalized.split(".");
  const scale = 10n ** BigInt(fraction.length);
  return (
    ((BigInt(integer) * scale + BigInt(fraction || "0")) * multiplier) /
    scale
  ).toString();
};

const regionNames = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "강원도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라북도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

export const parseEligibilityRequirements = (
  text: string,
  evidenceId: string,
): TenderParticipationRequirement[] =>
  splitClauses(text).flatMap(
    (clause) => parseEligibilityClause(clause, evidenceId).requirements,
  );

interface EligibilityParseResult {
  requirements: TenderParticipationRequirement[];
  ranges: TextRange[];
}

const parseEligibilityClause = (
  text: string,
  evidenceId: string,
): EligibilityParseResult => {
  const results: TenderParticipationRequirement[] = [];
  const ranges: TextRange[] = [];
  const consume = (pattern: RegExp) =>
    ranges.push(...matchingRanges(text, pattern));
  const required = isExplicitObligation(text);

  if (
    required &&
    /(?:소재지|지역).*(?:업체|참가|제한)|(?:업체|참가).*지역/.test(text)
  ) {
    const regionPaths = text
      .split(/\s*또는\s*/)
      .map((alternative) => {
        const broadRegions = regionNames.filter((name) =>
          alternative.includes(name),
        );
        const districts = (
          alternative.match(
            /[가-힣]+(?:시|군|구)(?=(?:인|에|\s|,|또는|및|$))/g,
          ) ?? []
        ).filter((name) => !regionNames.includes(name));
        return {
          codes: [],
          values: [...new Set([...broadRegions, ...districts])],
        };
      })
      .filter(({ values }) => values.length > 0);
    const all = [...new Set(regionPaths.flatMap(({ values }) => values))];
    if (all.length) {
      // Keep region names and their qualification grammar as separate ranges:
      // an unrecognized condition between them must never disappear.
      for (const name of all) consume(new RegExp(name, "g"));
      consume(/(?:본점|본사)?\s*(?:소재지|지역)(?:가|는|은)?/g);
      consume(/업체(?:만)?/g);
      results.push(
        requirementId({
          kind: "REGION",
          label: regionPaths
            .map(({ values }) => values.join(" "))
            .join(" 또는 "),
          codes: [],
          values: all,
          regionPaths,
          required: true,
          sourcePriority: "DOCUMENT",
          evidenceIds: [evidenceId],
        }),
      );
    }
  }

  const licenseMatches = [
    ...text.matchAll(/(?:업종|면허)\s*코드\s*[:：]?\s*([A-Za-z0-9-]+)/gi),
  ];
  if (required && licenseMatches.length) {
    const nameMatches = [
      ...text.matchAll(/([가-힣A-Za-z]+(?:공사업|면허))(?:\s*면허)?/g),
    ];
    const occurrences = [
      ...licenseMatches.map((match) => ({ match, kind: "CODE" as const })),
      ...nameMatches.map((match) => ({ match, kind: "NAME" as const })),
    ]
      .map(({ match, kind }) => ({
        kind,
        value: match[1],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      }))
      .sort((left, right) => left.start - right.start);
    const annotations: Array<TextRange & { occurrences: typeof occurrences }> =
      [];
    for (const occurrence of occurrences) {
      if (occurrence.kind === "CODE") ranges.push(occurrence);
      const previous = annotations[annotations.length - 1];
      // Only adjacent annotation syntax can associate a name with a code.
      // Obligation verbs, conjunctions, separators and substantive words end
      // the annotation, leaving independent name-only requirements unconsumed.
      if (
        previous &&
        /^[\s:：()[\]{}]*$/.test(text.slice(previous.end, occurrence.start))
      ) {
        previous.occurrences.push(occurrence);
        // A name's optional trailing "면허" can overlap the code's prefix.
        previous.end = Math.max(previous.end, occurrence.end);
      } else {
        annotations.push({ ...occurrence, occurrences: [occurrence] });
      }
    }
    const nameByCodeStart = new Map<number, string>();
    for (const annotation of annotations) {
      const codes = annotation.occurrences.filter(
        ({ kind }) => kind === "CODE",
      );
      const names = annotation.occurrences.filter(
        ({ kind }) => kind === "NAME",
      );
      // Multiple adjacent names/codes do not establish an unambiguous pairing.
      // Keep their names as UNKNOWN instead of guessing a code association.
      if (codes.length === 1 && names.length === 1) {
        nameByCodeStart.set(codes[0].start, names[0].value);
        ranges.push(names[0]);
      }
    }
    const groups: Array<{ codes: string[]; names: string[] }> = [];
    for (const [index, match] of licenseMatches.entries()) {
      const code = match[1].toUpperCase();
      const name = nameByCodeStart.get(match.index ?? 0);
      const previous = licenseMatches[index - 1];
      const previousEnd = previous
        ? (previous.index ?? 0) + previous[0].length
        : 0;
      const connector = previous ? text.slice(previousEnd, match.index) : "";
      if (previous && /(?:또는|혹은)/.test(connector)) {
        groups[groups.length - 1].codes.push(code);
        if (name) groups[groups.length - 1].names.push(name);
      } else {
        groups.push({ codes: [code], names: name ? [name] : [] });
      }
    }
    results.push(
      ...groups.map(({ codes, names: groupNames }) => {
        const names = [...new Set(groupNames)];
        const name = names.length ? names.join(" 또는 ") : "업종·면허";
        return requirementId({
          kind: "LICENSE",
          label: codes.length > 1 ? `${name} (${codes.join(" 또는 ")})` : name,
          codes: [...new Set(codes)].sort(),
          values: names.length ? names : [name],
          required: true,
          sourcePriority: "DOCUMENT",
          evidenceIds: [evidenceId],
        });
      }),
    );
  }

  if (required && /중소기업|소상공인/.test(text)) {
    consume(/(?:중소기업|소상공인)(?:\s*확인서)?/g);
    const codes = [
      ...(text.includes("중소기업") ? ["SME"] : []),
      ...(text.includes("소상공인") ? ["SMALL_BUSINESS"] : []),
    ];
    results.push(
      requirementId({
        kind: "COMPANY_TYPE",
        label:
          codes.length === 2
            ? "중소기업 또는 소상공인"
            : text.includes("중소기업")
              ? "중소기업"
              : "소상공인",
        codes,
        values: [],
        required: true,
        sourcePriority: "DOCUMENT",
        evidenceIds: [evidenceId],
      }),
    );
  }

  const directMatch =
    /(?:(?:세부품명번호\s*[:：]?\s*)?(\d{8,10})\s*)?직접생산확인(?:증명서)?/.exec(
      text,
    );
  if (required && directMatch) {
    ranges.push({
      start: directMatch.index,
      end: directMatch.index + directMatch[0].length,
    });
    results.push(
      requirementId({
        kind: "DIRECT_PRODUCTION",
        label: "직접생산확인",
        codes: directMatch[1] ? [directMatch[1]] : [],
        values: [],
        required: true,
        sourcePriority: "DOCUMENT",
        evidenceIds: [evidenceId],
      }),
    );
  }

  if (
    required &&
    /나라장터|조달청/.test(text) &&
    /(?:경쟁입찰)?참가자격|조달업체|등록/.test(text)
  ) {
    consume(/(?:나라장터|조달청)(?:\s*(?:(?:경쟁입찰)?참가자격|조달업체))?/g);
    results.push(
      requirementId({
        kind: "G2B_REGISTRATION",
        label: "나라장터 경쟁입찰참가자격 등록",
        codes: [],
        values: [],
        required: true,
        sourcePriority: "DOCUMENT",
        evidenceIds: [evidenceId],
      }),
    );
  }

  const performanceMatch =
    /최근\s*(\d+)\s*년\s*이내\s*([^\n.]*?)\s*(\d[\d,.]*)\s*(억|만)?원\s*이상/.exec(
      text,
    );
  if (required && performanceMatch) {
    ranges.push({
      start: performanceMatch.index,
      end: performanceMatch.index + performanceMatch[0].length,
    });
    const subject =
      performanceMatch[2].replace(/납품\s*실적\s*$/, "").trim() || "동종 물품";
    results.push(
      requirementId({
        kind: "PERFORMANCE",
        label: `${subject} 납품실적`,
        codes: [],
        values: [subject],
        periodYears: Number(performanceMatch[1]),
        minimumAmount: koreanAmount(performanceMatch[3], performanceMatch[4]),
        required: true,
        sourcePriority: "DOCUMENT",
        evidenceIds: [evidenceId],
      }),
    );
  }

  return { requirements: results, ranges };
};

const addDecimal = (left: string, right: string): string => {
  const fractionLength = Math.max(
    left.split(".")[1]?.length ?? 0,
    right.split(".")[1]?.length ?? 0,
  );
  const scale = 10n ** BigInt(fractionLength);
  const scaled = (value: string): bigint => {
    const [integer, fraction = ""] = decimal(value).split(".");
    const sign = integer.startsWith("-") ? -1n : 1n;
    const digits = integer.replace("-", "");
    return (
      sign *
      (BigInt(digits) * scale +
        BigInt(fraction.padEnd(fractionLength, "0") || "0"))
    );
  };
  const sum = scaled(left) + scaled(right);
  const sign = sum < 0n ? "-" : "";
  const absolute = sum < 0n ? -sum : sum;
  const integer = absolute / scale;
  const fraction = (absolute % scale)
    .toString()
    .padStart(fractionLength, "0")
    .replace(/0+$/, "");
  return `${sign}${integer}${fraction ? `.${fraction}` : ""}`;
};

export const parseBidFormulaText = (
  text: string,
  evidenceId: string,
): TenderBidFormula => {
  const result: TenderBidFormula = {};
  const lowerLimit = /낙찰\s*하한율(?:은|는|이|가|\s|:|：)*([\d,.]+)\s*%/.exec(
    text,
  );
  if (lowerLimit) result.lowerLimitRate = decimal(lowerLimit[1]);
  const reserveRange = new RegExp(
    `(?:예정가격\\s*범위[^.\\n]*?)?기초금액(?:의|\\s*)\\s*${DECIMAL}\\s*%\\s*이상\\s*${DECIMAL}\\s*%\\s*이하`,
  ).exec(text);
  if (reserveRange) {
    const minimumSigned = /^[+-]/.test(reserveRange[1]);
    const maximumSigned = /^[+-]/.test(reserveRange[2]);
    // Explicit signs identify offsets; unsigned percentages already refer to
    // the basis. Retain invalid sentinels so law defaults cannot mask a mixed
    // representation whose intended calculation has not been established.
    result.reservePriceMinimumRate =
      minimumSigned !== maximumSigned
        ? "UNKNOWN"
        : minimumSigned
          ? addDecimal("100", reserveRange[1])
          : decimal(reserveRange[1]);
    result.reservePriceMaximumRate =
      minimumSigned !== maximumSigned
        ? "UNKNOWN"
        : maximumSigned
          ? addDecimal("100", reserveRange[2])
          : decimal(reserveRange[2]);
  }
  if (Object.keys(result).length) result.evidenceIds = [evidenceId];
  return result;
};

const evidenceId = (input: Omit<TenderRequirementEvidence, "id">): string =>
  fingerprint(input);

const evidenceFromStructured = (
  reference: EvidenceRef,
  snippet: string,
): TenderRequirementEvidence => {
  const input: Omit<TenderRequirementEvidence, "id"> = {
    kind: "SOURCE",
    source: "STRUCTURED",
    state: null,
    snippet,
    operation: reference.operation,
    field: reference.field,
  };
  return { id: evidenceId(input), ...input };
};

const mergeUnique = <T extends { id: string }>(values: T[]): T[] =>
  [...new Map(values.map((value) => [value.id, value])).values()].sort(
    (left, right) => left.id.localeCompare(right.id),
  );

const stableSemanticSet = <T>(values: T[]): T[] =>
  [
    ...new Map(
      values.map((value) => [JSON.stringify(value), value] as const),
    ).values(),
  ].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );

const certificationRequirements = (
  text: string,
  itemKeys: string[],
  sourceEvidenceId: string,
): TenderCertificationRequirement[] =>
  splitClauses(text).flatMap((clause) => {
    const matches = certificationMatches(clause);
    const requiredByIndex = Array.from({ length: matches.length }, () => false);
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index];
      const next = matches[index + 1];
      const localContext = clause.slice(
        match.index,
        next?.index ?? clause.length,
      );
      const connector = next
        ? clause.slice(match.index + match.length, next.index).trim()
        : "";
      requiredByIndex[index] = isNegatedObligation(localContext)
        ? false
        : isExplicitObligation(localContext) ||
          (Boolean(next) &&
            /^(?:및|그리고|과|와)$/.test(connector) &&
            requiredByIndex[index + 1]);
    }
    return matches.map(({ code, name }, index) => {
      const input = {
        code,
        name,
        required: requiredByIndex[index],
        itemKeys: [...itemKeys].sort(),
        evidenceIds: [sourceEvidenceId],
      };
      return { id: fingerprint(input), ...input };
    });
  });

// Extend only from a recognized semantic range through adjacent grammatical
// tokens. Stop at the first substantive word, regardless of its connector.
// This intentionally does not delete obligation words from arbitrary prose.
const OBLIGATION_SUFFIX =
  /^(?:\s*(?:필수(?:(?:가|는|은)?\s*(?:아니며|아닙니다|아니다|아님)|입니다|이다|임)?|참가할\s*수\s*있습니다|확인서|등록|보유|제출|제한|하여야|해야|요함|하지\s*않아도|요구하지\s*않(?:습니다|음)?|불필요|아니며|입니다|합니다|이다|이며|이고|하며|하되|임|함|은|는|이|가|을|를|인|에|의))*/;
const GRAMMATICAL_GAP =
  /^(?:\s|[,.;:!。()[\]{}\/＋+·]|및|그리고|또는|혹은|과|와)*$/;

const unconsumedRecognizedText = (
  text: string,
  eligibilityRanges: TextRange[],
): string | null => {
  const ranges = [
    ...eligibilityRanges,
    ...matchingRanges(text, new RegExp(DIMENSION_PATTERN_SOURCE, "gi")),
    ...unitRules.flatMap(({ pattern }) => matchingRanges(text, pattern)),
    ...certificationMatches(text).map(({ index, length }) => ({
      start: index,
      end: index + length,
    })),
  ];
  if (!ranges.length) return null;

  const consumed = Array.from({ length: text.length }, () => false);
  for (const { start, end } of ranges) {
    const suffix = OBLIGATION_SUFFIX.exec(text.slice(end))?.[0] ?? "";
    for (let index = start; index < end + suffix.length; index += 1)
      consumed[index] = true;
  }
  // Evaluate each gap independently: joining gaps could accidentally turn two
  // unrelated text fragments into a recognized grammatical word.
  const residuals: string[] = [];
  let gap = "";
  for (let index = 0; index <= text.length; index += 1) {
    if (index < text.length && !consumed[index]) {
      gap += text[index];
    } else if (gap) {
      if (!GRAMMATICAL_GAP.test(gap)) residuals.push(gap);
      gap = "";
    }
  }
  return residuals.join(" ").trim();
};

const structuredRegionCondition = (
  regions: TenderRegionRequirement[],
  evidenceIds: string[],
): TenderParticipationRequirement | null => {
  if (!regions.length) return null;
  const ordered = [...regions].sort((left, right) =>
    left.code.localeCompare(right.code),
  );
  return requirementId({
    kind: "REGION",
    label: ordered.map(({ name }) => name).join(" 또는 "),
    codes: ordered.map(({ code }) => code),
    values: ordered.map(({ name }) => name),
    regionPaths: ordered.map(({ code, name }) => ({
      codes: [code],
      values: [name],
    })),
    required: ordered.some(({ required }) => required),
    sourcePriority: "STRUCTURED",
    evidenceIds: [...evidenceIds].sort(),
  });
};

const structuredLicenseConditions = (
  licenses: TenderLicenseRequirement[],
  evidenceIdByLicense: Map<TenderLicenseRequirement, string>,
): TenderParticipationRequirement[] => {
  const groups = new Map<string, TenderLicenseRequirement[]>();
  for (const license of licenses) {
    const key = license.group ?? `license:${license.code}`;
    groups.set(key, [...(groups.get(key) ?? []), license]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, members]) => {
      const ordered = [...members].sort((left, right) =>
        left.code.localeCompare(right.code),
      );
      return requirementId({
        kind: "LICENSE",
        label: ordered.map(({ name }) => name).join(" 또는 "),
        codes: ordered.map(({ code }) => code.toUpperCase()),
        values: ordered.map(({ name }) => name),
        required: ordered.some(({ required }) => required),
        sourcePriority: "STRUCTURED",
        evidenceIds: ordered.map((member) => evidenceIdByLicense.get(member)!),
      });
    });
};

const normalizedRegionTokens = (
  condition: TenderParticipationRequirement,
): string[] => {
  const paths = condition.regionPaths?.length
    ? condition.regionPaths
    : [{ codes: condition.codes, values: condition.values }];
  return paths
    .map(({ codes, values }) =>
      (codes.length
        ? codes
        : values.map((value) => TENDER_REGION_CODE_BY_NAME[value] ?? value)
      )
        .sort()
        .join("&"),
    )
    .sort();
};

const normalizedLicenseGroups = (
  conditions: TenderParticipationRequirement[],
): string[] =>
  conditions
    .map((condition) =>
      (condition.codes.length
        ? condition.codes.map((code) => code.trim().toUpperCase())
        : condition.values.map((value) => value.replace(/\s+/g, ""))
      )
        .sort()
        .join("|"),
    )
    .sort();

export class TenderRequirementParser {
  parse(
    enrichment: TenderEnrichment,
    documents: TenderRequirementDocument[],
  ): ParsedTenderRequirements {
    const evidence: TenderRequirementEvidence[] = [];
    // Missing/rejected source material must remain visible to the pure analyzer
    // as well as the job orchestrator. Use one stable value-free diagnostic.
    if (
      enrichment.failures.length ||
      enrichment.documents.some(
        (reference) =>
          !documents.some(
            (document) =>
              document.identity === reference.identity &&
              document.status === "EXTRACTED",
          ),
      )
    ) {
      const diagnostic: Omit<TenderRequirementEvidence, "id"> = {
        kind: "UNSUPPORTED",
        source: "STRUCTURED",
        state: "UNKNOWN",
        snippet:
          "공식 자료 일부를 확인하지 못했습니다. 참가 조건 원문 확인이 필요합니다.",
      };
      evidence.push({ id: evidenceId(diagnostic), ...diagnostic });
    }
    const certifications: TenderCertificationRequirement[] = [];
    const orderedPurchaseItems = [...enrichment.purchaseItems].sort(
      (left, right) =>
        `${left.classificationCode}:${left.specification ?? ""}`.localeCompare(
          `${right.classificationCode}:${right.specification ?? ""}`,
        ),
    );
    const items: TenderProcurementItemRequirements[] = orderedPurchaseItems.map(
      (item, index) => {
        const sourceEvidence = evidenceFromStructured(
          item.evidence,
          item.specification ?? item.name,
        );
        evidence.push(sourceEvidence);
        const key = `${item.classificationCode}:${index + 1}`;
        if (item.specification) {
          certifications.push(
            ...certificationRequirements(
              item.specification,
              [key],
              sourceEvidence.id,
            ),
          );
          evidence.push(
            ...this.unsupportedEvidence(
              item.specification,
              sourceEvidence,
              key,
              [key],
            ),
          );
        }
        return {
          key,
          classificationCode: item.classificationCode,
          specifications: item.specification
            ? parseUnitSpecifications(
                item.specification,
                key,
                sourceEvidence.id,
                "STRUCTURED",
              )
            : [],
          evidenceIds: [sourceEvidence.id],
          assignment: "ASSIGNED" as const,
        };
      },
    );
    const fallbackKey = "document:general";
    const targetItemKeys = items.length
      ? items.length === 1
        ? [items[0].key]
        : [fallbackKey]
      : [fallbackKey];
    const documentSpecifications: TenderSpecificationRequirement[] = [];
    const documentConditions: TenderParticipationRequirement[] = [];
    let documentBidFormula: TenderBidFormula = {};

    for (const document of [...documents].sort((left, right) =>
      `${left.identity}:${left.revision}`.localeCompare(
        `${right.identity}:${right.revision}`,
      ),
    )) {
      for (const block of [...document.blocks].sort(
        (left, right) => left.ordinal - right.ordinal,
      )) {
        const text =
          block.kind === "text" ? block.text : block.rows.flat().join(" | ");
        const input: Omit<TenderRequirementEvidence, "id"> = {
          kind: "SOURCE",
          source: "DOCUMENT",
          state: null,
          snippet: text,
          documentIdentity: document.identity,
          revision: document.revision,
          location: block.location,
        };
        const sourceEvidence: TenderRequirementEvidence = {
          id: evidenceId(input),
          ...input,
        };
        evidence.push(sourceEvidence);
        const documentItemKey = items.length === 1 ? items[0].key : fallbackKey;
        documentSpecifications.push(
          ...parseUnitSpecifications(text, documentItemKey, sourceEvidence.id),
        );
        certifications.push(
          ...certificationRequirements(text, targetItemKeys, sourceEvidence.id),
        );
        documentConditions.push(
          ...parseEligibilityRequirements(text, sourceEvidence.id),
        );
        const parsedFormula = parseBidFormulaText(text, sourceEvidence.id);
        documentBidFormula = { ...documentBidFormula, ...parsedFormula };

        evidence.push(
          ...this.unsupportedEvidence(
            text,
            sourceEvidence,
            documentItemKey,
            targetItemKeys,
          ),
        );
      }
    }

    if (documentSpecifications.length) {
      if (!items.length) {
        items.push({
          key: fallbackKey,
          classificationCode: null,
          specifications: documentSpecifications,
          evidenceIds: [
            ...new Set(
              documentSpecifications.flatMap(({ evidenceIds }) => evidenceIds),
            ),
          ],
          assignment: "ASSIGNED",
        });
      } else if (items.length === 1) {
        items[0].specifications.push(...documentSpecifications);
      } else {
        items.push({
          key: fallbackKey,
          classificationCode: null,
          specifications: documentSpecifications,
          evidenceIds: [
            ...new Set(
              documentSpecifications.flatMap(({ evidenceIds }) => evidenceIds),
            ),
          ],
          assignment: "UNASSIGNED",
        });
      }
    }

    const structuredRegionEvidence = enrichment.regions.map((region) => {
      const item = evidenceFromStructured(
        region.evidence,
        `${region.code} ${region.name}`,
      );
      evidence.push(item);
      return item.id;
    });
    const structuredRegion = structuredRegionCondition(
      enrichment.regions,
      structuredRegionEvidence,
    );
    const licenseEvidenceIds = new Map<TenderLicenseRequirement, string>();
    for (const license of enrichment.licenses) {
      const item = evidenceFromStructured(
        license.evidence,
        `${license.code} ${license.name}`,
      );
      evidence.push(item);
      licenseEvidenceIds.set(license, item.id);
    }
    const structuredLicenses = structuredLicenseConditions(
      enrichment.licenses,
      licenseEvidenceIds,
    );

    let participationConditions = documentConditions;
    if (structuredRegion) {
      const documentRegions = participationConditions.filter(
        ({ kind }) => kind === "REGION",
      );
      if (
        documentRegions.length &&
        fingerprint(documentRegions.flatMap(normalizedRegionTokens).sort()) !==
          fingerprint(normalizedRegionTokens(structuredRegion))
      ) {
        evidence.push(
          this.conflictEvidence(
            "REGION",
            structuredRegion.evidenceIds,
            documentRegions.flatMap(({ evidenceIds }) => evidenceIds),
          ),
        );
      }
      participationConditions = participationConditions.filter(
        ({ kind }) => kind !== "REGION",
      );
      participationConditions.push(structuredRegion);
    }
    if (structuredLicenses.length) {
      const documentLicenses = participationConditions.filter(
        ({ kind }) => kind === "LICENSE",
      );
      if (
        documentLicenses.length &&
        fingerprint(normalizedLicenseGroups(documentLicenses)) !==
          fingerprint(normalizedLicenseGroups(structuredLicenses))
      ) {
        evidence.push(
          this.conflictEvidence(
            "LICENSE",
            structuredLicenses.flatMap(({ evidenceIds }) => evidenceIds),
            documentLicenses.flatMap(({ evidenceIds }) => evidenceIds),
          ),
        );
      }
      participationConditions = participationConditions.filter(
        ({ kind }) => kind !== "LICENSE",
      );
      participationConditions.push(...structuredLicenses);
    }

    const structuredFormula = this.structuredFormula(enrichment, evidence);
    const formulaConflictFields: Array<[keyof TenderBidFormula, string]> = [
      ["lowerLimitRate", "LOWER_LIMIT_RATE"],
      ["reservePriceMinimumRate", "RESERVE_PRICE_MINIMUM_RATE"],
      ["reservePriceMaximumRate", "RESERVE_PRICE_MAXIMUM_RATE"],
    ];
    for (const [field, label] of formulaConflictFields) {
      if (
        structuredFormula[field] !== undefined &&
        documentBidFormula[field] !== undefined &&
        decimal(String(structuredFormula[field])) !==
          decimal(String(documentBidFormula[field]))
      ) {
        evidence.push(
          this.conflictEvidence(
            label,
            structuredFormula.evidenceIds ?? [],
            documentBidFormula.evidenceIds ?? [],
          ),
        );
      }
    }
    const bidFormula = { ...documentBidFormula, ...structuredFormula };
    if (documentBidFormula.evidenceIds || structuredFormula.evidenceIds) {
      bidFormula.evidenceIds = [
        ...(documentBidFormula.evidenceIds ?? []),
        ...(structuredFormula.evidenceIds ?? []),
      ].sort();
    }

    const normalized = {
      items: items
        .map((item) => ({
          ...item,
          specifications: this.reconcileSpecifications(
            item.specifications,
            evidence,
          ),
          evidenceIds: [...new Set(item.evidenceIds)].sort(),
        }))
        .sort((left, right) => left.key.localeCompare(right.key)),
      certifications: mergeUnique(certifications),
      participationConditions: mergeUnique(participationConditions),
      bidFormula,
      evidence: mergeUnique(evidence),
    };
    return { ...normalized, fingerprint: fingerprint(normalized) };
  }

  private unsupportedEvidence(
    text: string,
    sourceEvidence: TenderRequirementEvidence,
    itemKey: string,
    itemKeys: string[],
  ): TenderRequirementEvidence[] {
    return splitRequirementSpans(text).flatMap((span) => {
      const eligibility = parseEligibilityClause(span, sourceEvidence.id);
      const unconsumedText = unconsumedRecognizedText(span, eligibility.ranges);
      const hasUnhandledRecognizedResidual = Boolean(unconsumedText);
      const parsed =
        parseUnitSpecifications(span, itemKey, sourceEvidence.id).length > 0 ||
        certificationRequirements(span, itemKeys, sourceEvidence.id).length >
          0 ||
        eligibility.requirements.length > 0 ||
        Object.keys(parseBidFormulaText(span, sourceEvidence.id)).length > 0;
      const explicitlyNonBinding =
        /(?:권장|선호|참고)/.test(span) && !isExplicitObligation(span);
      const requirementBearing =
        /(?:인증|방폭|자격|업체|참가|실적|제품|사양|규격|필수|하여야|해야|제출|등록|보유|제한|이상|이하|초과|미만|권장|선호|필요)/.test(
          span,
        );
      if (
        !requirementBearing ||
        (parsed && !hasUnhandledRecognizedResidual && !explicitlyNonBinding)
      ) {
        return [];
      }
      const input: Omit<TenderRequirementEvidence, "id"> = {
        kind: "UNSUPPORTED",
        source: sourceEvidence.source,
        state: "UNKNOWN",
        snippet: span,
        operation: sourceEvidence.operation,
        field: sourceEvidence.field,
        documentIdentity: sourceEvidence.documentIdentity,
        revision: sourceEvidence.revision,
        location: sourceEvidence.location,
        relatedEvidenceIds: [sourceEvidence.id],
      };
      return [{ id: evidenceId(input), ...input }];
    });
  }

  private reconcileSpecifications(
    specifications: TenderSpecificationRequirement[],
    evidence: TenderRequirementEvidence[],
  ): TenderSpecificationRequirement[] {
    const byKind = new Map<
      TenderSpecificationKind,
      TenderSpecificationRequirement[]
    >();
    for (const specification of specifications) {
      byKind.set(specification.kind, [
        ...(byKind.get(specification.kind) ?? []),
        specification,
      ]);
    }
    return mergeUnique(
      [...byKind.entries()].flatMap(([kind, members]) => {
        const structured = members.filter(
          ({ sourcePriority }) => sourcePriority === "STRUCTURED",
        );
        const document = members.filter(
          ({ sourcePriority }) => sourcePriority !== "STRUCTURED",
        );
        if (!structured.length || !document.length) return members;
        const semantic = (requirement: TenderSpecificationRequirement) => ({
          comparator: requirement.comparator,
          value: requirement.value,
          values: requirement.values,
          unit: requirement.unit,
          required: requirement.required,
        });
        if (
          fingerprint(stableSemanticSet(structured.map(semantic))) !==
          fingerprint(stableSemanticSet(document.map(semantic)))
        ) {
          evidence.push(
            this.conflictEvidence(
              `SPECIFICATION:${kind}`,
              structured.flatMap(({ evidenceIds }) => evidenceIds),
              document.flatMap(({ evidenceIds }) => evidenceIds),
            ),
          );
        }
        const documentEvidenceIds = document.flatMap(
          ({ evidenceIds }) => evidenceIds,
        );
        return structured.map((requirement) => ({
          ...requirement,
          evidenceIds: [
            ...new Set([...requirement.evidenceIds, ...documentEvidenceIds]),
          ].sort(),
        }));
      }),
    );
  }

  private structuredFormula(
    enrichment: TenderEnrichment,
    evidence: TenderRequirementEvidence[],
  ): TenderBidFormula {
    const result: TenderBidFormula = {};
    const evidenceIds: string[] = [];
    const add = (
      value: string,
      reference: EvidenceRef,
      field: keyof TenderBidFormula,
    ) => {
      const item = evidenceFromStructured(reference, value);
      evidence.push(item);
      evidenceIds.push(item.id);
      result[field] = value as never;
    };
    if (enrichment.basisAmount)
      add(
        enrichment.basisAmount.value,
        enrichment.basisAmount.evidence,
        "basisAmount",
      );
    if (enrichment.lowerLimitRate)
      add(
        decimal(enrichment.lowerLimitRate.value.replace(/%$/, "")),
        enrichment.lowerLimitRate.evidence,
        "lowerLimitRate",
      );
    if (enrichment.lawKind)
      add(enrichment.lawKind.value, enrichment.lawKind.evidence, "lawKind");
    const fields: Record<string, keyof TenderBidFormula> = {
      reservePriceMinimumRate: "reservePriceMinimumRate",
      reservePriceMaximumRate: "reservePriceMaximumRate",
      evaluationBasisAmount: "evaluationBasisAmount",
      reservePriceMethod: "reservePriceMethod",
      plannedPriceMethod: "plannedPriceMethod",
    };
    for (const variable of [...enrichment.formulaVariables].sort(
      (left, right) => left.key.localeCompare(right.key),
    )) {
      const field = fields[variable.key];
      if (field) {
        // Official G2B range fields are offsets (-3/+3). Parsed requirements
        // always expose absolute percentages (97/103), also used by documents.
        const isOfficialOffset =
          variable.evidence.source === "G2B_API" &&
          variable.evidence.operation ===
            "getBidPblancListInfoThngBsisAmount" &&
          ((field === "reservePriceMinimumRate" &&
            variable.evidence.field === "rsrvtnPrceRngBgnRate") ||
            (field === "reservePriceMaximumRate" &&
              variable.evidence.field === "rsrvtnPrceRngEndRate"));
        add(
          isOfficialOffset &&
            /^[+-]?\d{1,8}(?:\.\d{1,8})?$/.test(variable.value)
            ? addDecimal("100", variable.value)
            : variable.value,
          variable.evidence,
          field,
        );
      }
    }
    for (const fact of enrichment.pricingEvidence ?? []) {
      const item = evidenceFromStructured(fact.evidence, fact.value);
      evidence.push(item);
      evidenceIds.push(item.id);
    }
    if (evidenceIds.length) result.evidenceIds = evidenceIds.sort();
    return result;
  }

  private conflictEvidence(
    conflictField: string,
    structuredEvidenceIds: string[],
    documentEvidenceIds: string[],
  ): TenderRequirementEvidence {
    const input: Omit<TenderRequirementEvidence, "id"> = {
      kind: "CONFLICT",
      source: "STRUCTURED",
      state: "UNKNOWN",
      snippet: `구조화 필드가 문서의 ${conflictField} 값과 충돌하여 구조화 값을 적용했습니다.`,
      conflictField,
      relatedEvidenceIds: [
        ...structuredEvidenceIds,
        ...documentEvidenceIds,
      ].sort(),
    };
    return { id: evidenceId(input), ...input };
  }
}

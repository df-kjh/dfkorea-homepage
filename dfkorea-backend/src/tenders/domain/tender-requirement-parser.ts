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
} from "./tender-requirement";

const DECIMAL = "([+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)";
const OBLIGATION =
  /(?:필수|하여야|해야|요함|제출|보유|등록|제한|참가할\s*수|업체만|이상|이하|초과|미만)/;

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
): TenderSpecificationRequirement => {
  const normalized = {
    itemKey,
    kind,
    unit,
    comparator,
    ...(Array.isArray(value) ? { values: value } : { value }),
    required,
    evidenceIds: [evidenceId],
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

export const parseUnitSpecifications = (
  text: string,
  itemKey: string,
  evidenceId: string,
): TenderSpecificationRequirement[] => {
  const results: Array<{
    index: number;
    requirement: TenderSpecificationRequirement;
  }> = [];
  const dimensionPattern = new RegExp(
    `(?:외형\\s*)?(?:치수|크기|규격)\\s*[:：]?\\s*${DECIMAL}\\s*[x×X＊*]\\s*${DECIMAL}\\s*[x×X＊*]\\s*${DECIMAL}\\s*(?:mm|밀리미터)\\s*(이상|이하|초과|미만)?`,
    "gi",
  );
  for (const match of text.matchAll(dimensionPattern)) {
    const comparator = comparatorOf(match[4]);
    results.push({
      index: match.index ?? 0,
      requirement: makeSpecification(
        itemKey,
        evidenceId,
        "DIMENSIONS",
        "MM",
        comparator,
        [decimal(match[1]), decimal(match[2]), decimal(match[3])],
        comparator !== "EQ" || OBLIGATION.test(match[0]),
      ),
    });
  }
  for (const rule of unitRules) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const comparator = comparatorOf(match[2]);
      results.push({
        index: match.index ?? 0,
        requirement: makeSpecification(
          itemKey,
          evidenceId,
          rule.kind,
          rule.unit,
          comparator,
          decimal(match[1]),
          comparator !== "EQ" || OBLIGATION.test(match[0]),
        ),
      });
    }
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

const REGION_CODES: Readonly<Record<string, string>> = {
  서울특별시: "11",
  부산광역시: "26",
  대구광역시: "27",
  인천광역시: "28",
  광주광역시: "29",
  대전광역시: "30",
  울산광역시: "31",
  세종특별자치시: "36",
  경기도: "41",
  충청북도: "43",
  충청남도: "44",
  전라북도: "45",
  전북특별자치도: "45",
  전라남도: "46",
  경상북도: "47",
  경상남도: "48",
  제주특별자치도: "50",
  강원도: "51",
  강원특별자치도: "51",
};

export const parseEligibilityRequirements = (
  text: string,
  evidenceId: string,
): TenderParticipationRequirement[] =>
  text
    .split(/[.。\n]+/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .flatMap((clause) => parseEligibilityClause(clause, evidenceId));

const parseEligibilityClause = (
  text: string,
  evidenceId: string,
): TenderParticipationRequirement[] => {
  const results: TenderParticipationRequirement[] = [];
  const required = OBLIGATION.test(text);

  if (
    required &&
    /(?:소재지|지역).*(?:업체|참가|제한)|(?:업체|참가).*지역/.test(text)
  ) {
    const values = regionNames.filter((name) => text.includes(name));
    const sigungu =
      text.match(/[가-힣]+(?:시|군|구)(?=(?:인|에|\s|,|또는|및))/g) ?? [];
    const all = [...new Set([...values, ...sigungu])];
    if (all.length) {
      results.push(
        requirementId({
          kind: "REGION",
          label: all.join(" 또는 "),
          codes: [],
          values: all,
          required: true,
          sourcePriority: "DOCUMENT",
          evidenceIds: [evidenceId],
        }),
      );
    }
  }

  const licenseMatch = /(?:업종|면허)\s*코드\s*[:：]?\s*([A-Za-z0-9-]+)/i.exec(
    text,
  );
  if (required && licenseMatch) {
    const name =
      /([가-힣A-Za-z]+(?:공사업|면허))/.exec(text)?.[1] ?? "업종·면허";
    results.push(
      requirementId({
        kind: "LICENSE",
        label: name,
        codes: [licenseMatch[1].toUpperCase()],
        values: [name],
        required: true,
        sourcePriority: "DOCUMENT",
        evidenceIds: [evidenceId],
      }),
    );
  }

  if (required && /중소기업|소상공인/.test(text)) {
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
    /(?:세부품명번호\s*[:：]?\s*)?(\d{8,10})?[^.\n]*직접생산확인(?:증명서)?/.exec(
      text,
    );
  if (required && directMatch) {
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

  return results;
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
    result.reservePriceMinimumRate = addDecimal("100", reserveRange[1]);
    result.reservePriceMaximumRate = addDecimal("100", reserveRange[2]);
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

const certificationRequirements = (
  text: string,
  itemKeys: string[],
  sourceEvidenceId: string,
): TenderCertificationRequirement[] =>
  text
    .split(/[.。\n]+/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .flatMap((clause) =>
      CERTIFICATION_ALIASES.flatMap(({ code, name, pattern }) => {
        pattern.lastIndex = 0;
        const match = pattern.exec(clause);
        if (!match) return [];
        const required = OBLIGATION.test(clause);
        const input = {
          code,
          name,
          required,
          itemKeys: [...itemKeys].sort(),
          evidenceIds: [sourceEvidenceId],
        };
        return [{ id: fingerprint(input), ...input }];
      }),
    );

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
): string[] =>
  (condition.codes.length
    ? condition.codes
    : condition.values.map((value) => REGION_CODES[value] ?? value)
  ).sort();

export class TenderRequirementParser {
  parse(
    enrichment: TenderEnrichment,
    documents: TenderRequirementDocument[],
  ): ParsedTenderRequirements {
    const evidence: TenderRequirementEvidence[] = [];
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
        return {
          key,
          classificationCode: item.classificationCode,
          specifications: item.specification
            ? parseUnitSpecifications(
                item.specification,
                key,
                sourceEvidence.id,
              )
            : [],
          evidenceIds: [sourceEvidence.id],
        };
      },
    );
    const fallbackKey = "document:general";
    const targetItemKeys = items.length
      ? items.map(({ key }) => key)
      : [fallbackKey];
    const documentSpecifications: TenderSpecificationRequirement[] = [];
    const certifications: TenderCertificationRequirement[] = [];
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

        for (const clause of text
          .split(/[.。\n]+/)
          .map((value) => value.trim())
          .filter(Boolean)) {
          const parsedClause =
            parseUnitSpecifications(clause, documentItemKey, sourceEvidence.id)
              .length > 0 ||
            certificationRequirements(clause, targetItemKeys, sourceEvidence.id)
              .length > 0 ||
            parseEligibilityRequirements(clause, sourceEvidence.id).length >
              0 ||
            Object.keys(parseBidFormulaText(clause, sourceEvidence.id)).length >
              0;
          const explicitlyNonBinding =
            /(?:권장|선호|참고)/.test(clause) && !OBLIGATION.test(clause);
          if (
            (!parsedClause || explicitlyNonBinding) &&
            /(?:인증|자격|업체|참가|실적|제품|사양|규격|권장|선호|필요)/.test(
              clause,
            )
          ) {
            const unsupportedInput: Omit<TenderRequirementEvidence, "id"> = {
              kind: "UNSUPPORTED",
              source: "DOCUMENT",
              state: "UNKNOWN",
              snippet: clause,
              documentIdentity: document.identity,
              revision: document.revision,
              location: block.location,
              relatedEvidenceIds: [sourceEvidence.id],
            };
            evidence.push({
              id: evidenceId(unsupportedInput),
              ...unsupportedInput,
            });
          }
        }
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
      if (documentLicenses.length) {
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
    if (
      structuredFormula.lowerLimitRate &&
      documentBidFormula.lowerLimitRate &&
      structuredFormula.lowerLimitRate !== documentBidFormula.lowerLimitRate
    ) {
      evidence.push(
        this.conflictEvidence(
          "LOWER_LIMIT_RATE",
          structuredFormula.evidenceIds ?? [],
          documentBidFormula.evidenceIds ?? [],
        ),
      );
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
          specifications: mergeUnique(item.specifications),
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
      if (field) add(variable.value, variable.evidence, field);
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

import {
  TenderCompanyProfileDto,
  TenderCompanyQualificationDto,
} from "../dto/tender-company-profile.dto";
import {
  TenderRequirementState,
  TenderSuitability,
} from "./tender-analysis.enums";
import {
  canonicalJson,
  fingerprint,
  ParsedTenderRequirements,
  TenderCertificationRequirement,
  TenderComparator,
  TenderParticipationRequirement,
  TenderProductSnapshot,
  TenderRequirementEvaluation,
  TenderSpecificationRequirement,
  TenderSuitabilityResult,
  TENDER_REGION_CODE_BY_NAME,
} from "./tender-requirement";

interface DecimalParts {
  integer: bigint;
  scale: number;
}

const decimalParts = (value: string | number): DecimalParts | null => {
  const normalized = String(value).trim().replace(/,/g, "");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const sign = normalized.startsWith("-") ? -1n : 1n;
  const unsigned = normalized.replace(/^[+-]/, "");
  const [integer, fraction = ""] = unsigned.split(".");
  return {
    integer: sign * BigInt(`${integer}${fraction}`),
    scale: fraction.length,
  };
};

const compareDecimals = (
  left: string | number,
  right: string | number,
): number | null => {
  const first = decimalParts(left);
  const second = decimalParts(right);
  if (!first || !second) return null;
  const scale = Math.max(first.scale, second.scale);
  const leftValue = first.integer * 10n ** BigInt(scale - first.scale);
  const rightValue = second.integer * 10n ** BigInt(scale - second.scale);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
};

const satisfiesComparator = (
  actual: string | number,
  expected: string,
  comparator: TenderComparator,
): boolean | null => {
  const compared = compareDecimals(actual, expected);
  if (compared === null) return null;
  switch (comparator) {
    case "EQ":
      return compared === 0;
    case "GTE":
      return compared >= 0;
    case "LTE":
      return compared <= 0;
    case "GT":
      return compared > 0;
    case "LT":
      return compared < 0;
  }
};

const stateFromComparisons = (
  comparisons: Array<boolean | null>,
): TenderRequirementState => {
  if (!comparisons.length || comparisons.every((value) => value === null)) {
    return TenderRequirementState.UNKNOWN;
  }
  return comparisons.some(Boolean)
    ? TenderRequirementState.SATISFIED
    : TenderRequirementState.UNSATISFIED;
};

const dimensionValues = (value: string): string[] | null => {
  const match =
    /([\d,.]+)\s*[x×X＊*]\s*([\d,.]+)\s*[x×X＊*]\s*([\d,.]+)(?:\s*(?:mm|밀리미터))?/i.exec(
      value,
    );
  return match ? [match[1], match[2], match[3]] : null;
};

const numericText = (value: string | undefined): string | null =>
  value ? (/[\d,.]+/.exec(value)?.[0] ?? null) : null;

const evaluateSpecification = (
  requirement: TenderSpecificationRequirement,
  product: TenderProductSnapshot,
): TenderRequirementState => {
  if (requirement.kind === "DIMENSIONS") {
    const actual = dimensionValues(product.dimensions);
    if (
      !actual ||
      !requirement.values ||
      actual.length !== requirement.values.length
    ) {
      return TenderRequirementState.UNKNOWN;
    }
    const comparisons = actual.map((value, index) =>
      satisfiesComparator(
        value,
        requirement.values![index],
        requirement.comparator,
      ),
    );
    if (comparisons.some((value) => value === null))
      return TenderRequirementState.UNKNOWN;
    return comparisons.every(Boolean)
      ? TenderRequirementState.SATISFIED
      : TenderRequirementState.UNSATISFIED;
  }

  if (!requirement.value) return TenderRequirementState.UNKNOWN;
  let actualValues: Array<string | number> = [];
  switch (requirement.kind) {
    case "POWER":
      actualValues = product.power;
      break;
    case "LUMINOUS_EFFICACY":
      if (product.luminanceEfficiency !== undefined) {
        actualValues = [product.luminanceEfficiency];
      }
      break;
    case "COLOR_TEMPERATURE":
      actualValues = product.colorTemp;
      break;
    case "IP_RATING": {
      const parsed = numericText(product.ipRating);
      if (parsed) actualValues = [parsed];
      break;
    }
    case "CRI": {
      const parsed = numericText(product.colorRendering);
      if (parsed) actualValues = [parsed];
      break;
    }
  }
  return stateFromComparisons(
    actualValues.map((value) =>
      satisfiesComparator(value, requirement.value!, requirement.comparator),
    ),
  );
};

const normalizedCertificationCodes = (values: string[]): Set<string> => {
  const codes = new Set<string>();
  for (const value of values) {
    const normalized = value.toUpperCase().replace(/[\s_-]+/g, "");
    if (/고효율/.test(value)) codes.add("HIGH_EFFICIENCY");
    if (/환경\s*표지/.test(value)) codes.add("ECO_LABEL");
    if (/VCHECK/.test(normalized)) codes.add("V_CHECK");
    if (
      /(?:^|[^A-Z])KC(?:[^A-Z]|$)/.test(value.toUpperCase()) ||
      normalized === "KC"
    ) {
      codes.add("KC");
    }
    if (
      /(?:^|[^A-Z])KS(?:[^A-Z]|$)/.test(value.toUpperCase()) ||
      normalized === "KS"
    ) {
      codes.add("KS");
    }
    codes.add(value.trim().toUpperCase());
  }
  return codes;
};

const evaluateCertificationForProduct = (
  requirement: TenderCertificationRequirement,
  product: TenderProductSnapshot | null,
  profile: TenderCompanyProfileDto,
  currentDate: string,
): TenderRequirementState => {
  if (!product) return TenderRequirementState.UNKNOWN;
  if (
    !normalizedCertificationCodes(product.certifications).has(requirement.code)
  ) {
    return TenderRequirementState.UNSATISFIED;
  }
  const matchingProfileRecords = profile.certifications.filter(
    (qualification) =>
      normalizedCertificationCodes([
        qualification.code,
        qualification.name,
      ]).has(requirement.code),
  );
  return matchingProfileRecords.length === 0 ||
    matchingProfileRecords.some((qualification) =>
      validOn(qualification, currentDate),
    )
    ? TenderRequirementState.SATISFIED
    : TenderRequirementState.UNSATISFIED;
};

const stableSort = <T>(values: T[]): T[] =>
  [...values].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right)),
  );

const validOn = (
  qualification: TenderCompanyQualificationDto,
  date: string,
): boolean =>
  qualification.expiresAt === null ||
  qualification.expiresAt.slice(0, 10) >= date;

const matchesQualification = (
  qualifications: TenderCompanyQualificationDto[],
  condition: TenderParticipationRequirement,
  date: string,
): boolean => {
  const codes = new Set(
    condition.codes.map((value) => value.trim().toUpperCase()),
  );
  const names = condition.values.map((value) => value.replace(/\s+/g, ""));
  return qualifications.some(
    (qualification) =>
      validOn(qualification, date) &&
      (codes.size > 0
        ? codes.has(qualification.code.trim().toUpperCase())
        : names.some((name) =>
            qualification.name.replace(/\s+/g, "").includes(name),
          )),
  );
};

const subtractYears = (date: Date, years: number): string => {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() - years);
  return result.toISOString().slice(0, 10);
};

const sumDecimals = (values: string[]): string => {
  const parsed = values
    .map(decimalParts)
    .filter((value): value is DecimalParts => value !== null);
  if (!parsed.length) return "0";
  const scale = Math.max(...parsed.map((value) => value.scale));
  const total = parsed.reduce(
    (sum, value) => sum + value.integer * 10n ** BigInt(scale - value.scale),
    0n,
  );
  const sign = total < 0n ? "-" : "";
  const absolute = total < 0n ? -total : total;
  const divisor = 10n ** BigInt(scale);
  const fraction = (absolute % divisor)
    .toString()
    .padStart(scale, "0")
    .replace(/0+$/, "");
  return `${sign}${absolute / divisor}${fraction ? `.${fraction}` : ""}`;
};

const evaluateParticipation = (
  condition: TenderParticipationRequirement,
  profile: TenderCompanyProfileDto,
  now: Date,
): TenderRequirementState => {
  const currentDate = now.toISOString().slice(0, 10);
  switch (condition.kind) {
    case "REGION": {
      const values = new Set([
        profile.headquarters.sido,
        profile.headquarters.sigungu,
        `${profile.headquarters.sido} ${profile.headquarters.sigungu}`,
      ]);
      const regionCode = TENDER_REGION_CODE_BY_NAME[profile.headquarters.sido];
      const matched = condition.regionPaths?.length
        ? condition.regionPaths.some((path) => {
            const canonicalCodes = new Set(path.codes);
            const geographicValues = path.values.filter((required) => {
              const aliasCode = TENDER_REGION_CODE_BY_NAME[required];
              return !aliasCode || !canonicalCodes.has(aliasCode);
            });
            return (
              path.codes.every((code) => code === regionCode) &&
              geographicValues.every((required) =>
                [...values].some(
                  (actual) => actual === required || actual.includes(required),
                ),
              )
            );
          })
        : condition.codes.includes(regionCode) ||
          condition.values.some((required) =>
            [...values].some(
              (actual) => actual === required || actual.includes(required),
            ),
          );
      return matched
        ? TenderRequirementState.SATISFIED
        : TenderRequirementState.UNSATISFIED;
    }
    case "LICENSE":
      return matchesQualification(profile.licenses, condition, currentDate)
        ? TenderRequirementState.SATISFIED
        : TenderRequirementState.UNSATISFIED;
    case "COMPANY_TYPE": {
      const aliases = profile.companyTypes.map((qualification) => {
        const name = qualification.name.replace(/\s+/g, "");
        return {
          ...qualification,
          code: /소상공인/.test(name)
            ? "SMALL_BUSINESS"
            : /중소기업/.test(name)
              ? "SME"
              : qualification.code,
        };
      });
      return matchesQualification(aliases, condition, currentDate)
        ? TenderRequirementState.SATISFIED
        : TenderRequirementState.UNSATISFIED;
    }
    case "DIRECT_PRODUCTION":
      if (!condition.codes.length && !condition.values.length) {
        return TenderRequirementState.UNKNOWN;
      }
      return matchesQualification(
        profile.directProduction,
        condition,
        currentDate,
      )
        ? TenderRequirementState.SATISFIED
        : TenderRequirementState.UNSATISFIED;
    case "G2B_REGISTRATION":
      return profile.g2bRegistered
        ? TenderRequirementState.SATISFIED
        : TenderRequirementState.UNSATISFIED;
    case "PERFORMANCE": {
      if (!condition.minimumAmount || !condition.periodYears) {
        return TenderRequirementState.UNKNOWN;
      }
      const cutoff = subtractYears(now, condition.periodYears);
      const subjects = condition.values.map((value) =>
        value.replace(/\s+/g, ""),
      );
      if (subjects.some((subject) => subject.includes("동종"))) {
        return TenderRequirementState.UNKNOWN;
      }
      const matching = profile.performanceRecords.filter((record) => {
        const itemName = record.itemName.replace(/\s+/g, "");
        const from = record.from.slice(0, 10);
        const to = record.to.slice(0, 10);
        return (
          from <= to &&
          from <= currentDate &&
          to >= cutoff &&
          to <= currentDate &&
          subjects.length > 0 &&
          subjects.some((subject) => itemName.includes(subject))
        );
      });
      return (compareDecimals(
        sumDecimals(matching.map(({ amount }) => amount)),
        condition.minimumAmount,
      ) ?? -1) >= 0
        ? TenderRequirementState.SATISFIED
        : TenderRequirementState.UNSATISFIED;
    }
  }
};

interface ProductEvaluation {
  product: TenderProductSnapshot;
  specifications: TenderRequirementEvaluation[];
  certifications: TenderRequirementEvaluation[];
  weightedSatisfied: number;
  weightedUnsatisfied: number;
  certificationSatisfied: number;
  certificationUnsatisfied: number;
  unknown: number;
}

const resultFingerprintInputs = (
  requirements: ParsedTenderRequirements,
  profile: TenderCompanyProfileDto,
  products: TenderProductSnapshot[],
) => {
  const normalizedRequirements = {
    items: stableSort(
      requirements.items.map((item) => ({
        ...item,
        specifications: stableSort(item.specifications),
        evidenceIds: [...item.evidenceIds].sort(),
      })),
    ),
    certifications: stableSort(requirements.certifications),
    participationConditions: stableSort(requirements.participationConditions),
    bidFormula: requirements.bidFormula,
    evidence: stableSort(requirements.evidence),
  };
  const normalizedProfile = {
    ...profile,
    supplyProducts: stableSort(profile.supplyProducts),
    licenses: stableSort(profile.licenses),
    companyTypes: stableSort(profile.companyTypes),
    directProduction: stableSort(profile.directProduction),
    certifications: stableSort(profile.certifications),
    performanceRecords: stableSort(profile.performanceRecords),
  };
  const normalizedProducts = stableSort(
    products.map((item) => ({
      ...item,
      power: [...item.power].sort((left, right) => left - right),
      colorTemp: [...item.colorTemp].sort((left, right) => left - right),
      certifications: [...item.certifications].sort(),
    })),
  );
  return {
    requirements: fingerprint(normalizedRequirements),
    profile: fingerprint(normalizedProfile),
    products: fingerprint(normalizedProducts),
  };
};

export class TenderSuitabilityAnalyzer {
  analyze(
    requirements: ParsedTenderRequirements,
    profile: TenderCompanyProfileDto,
    products: TenderProductSnapshot[],
    now: Date,
  ): TenderSuitabilityResult {
    const currentDate = now.toISOString().slice(0, 10);
    const selectedByItem = new Map<string, ProductEvaluation | null>();
    const specificationResults: TenderRequirementEvaluation[] = [];

    for (const item of requirements.items) {
      if (item.assignment === "UNASSIGNED") {
        selectedByItem.set(item.key, null);
        specificationResults.push(
          ...item.specifications.map((requirement) => ({
            requirementId: requirement.id,
            state: TenderRequirementState.UNKNOWN,
            required: requirement.required,
            evidenceIds: requirement.evidenceIds,
          })),
        );
        continue;
      }
      const itemCertifications = requirements.certifications.filter(
        ({ itemKeys }) => itemKeys.length === 0 || itemKeys.includes(item.key),
      );
      const candidates = products.map((product) => {
        const specifications = item.specifications.map((requirement) => ({
          requirementId: requirement.id,
          state: evaluateSpecification(requirement, product),
          required: requirement.required,
          evidenceIds: requirement.evidenceIds,
        }));
        const certifications = itemCertifications.map((requirement) => ({
          requirementId: requirement.id,
          state: evaluateCertificationForProduct(
            requirement,
            product,
            profile,
            currentDate,
          ),
          required: requirement.required,
          evidenceIds: requirement.evidenceIds,
        }));
        return {
          product,
          specifications,
          certifications,
          weightedSatisfied: specifications.reduce(
            (total, result, index) =>
              total +
              (result.state === TenderRequirementState.SATISFIED
                ? item.specifications[index].required
                  ? 2
                  : 1
                : 0),
            0,
          ),
          weightedUnsatisfied: specifications.reduce(
            (total, result, index) =>
              total +
              (result.state === TenderRequirementState.UNSATISFIED
                ? item.specifications[index].required
                  ? 2
                  : 1
                : 0),
            0,
          ),
          certificationSatisfied: certifications.filter(
            ({ state }) => state === TenderRequirementState.SATISFIED,
          ).length,
          certificationUnsatisfied: certifications.filter(
            ({ state }) => state === TenderRequirementState.UNSATISFIED,
          ).length,
          unknown: specifications.filter(
            ({ state }) => state === TenderRequirementState.UNKNOWN,
          ).length,
        };
      });
      candidates.sort(
        (left, right) =>
          right.weightedSatisfied - left.weightedSatisfied ||
          left.weightedUnsatisfied - right.weightedUnsatisfied ||
          right.certificationSatisfied - left.certificationSatisfied ||
          left.certificationUnsatisfied - right.certificationUnsatisfied ||
          left.unknown - right.unknown ||
          canonicalJson(left.product).localeCompare(
            canonicalJson(right.product),
          ),
      );
      const selected = candidates[0] ?? null;
      selectedByItem.set(item.key, selected);
      specificationResults.push(
        ...(selected?.specifications ??
          item.specifications.map((requirement) => ({
            requirementId: requirement.id,
            state: TenderRequirementState.UNKNOWN,
            required: requirement.required,
            evidenceIds: requirement.evidenceIds,
          }))),
      );
    }

    const certificationResults = requirements.certifications.map(
      (requirement) => {
        const itemKeys = requirement.itemKeys.length
          ? requirement.itemKeys
          : [...selectedByItem.keys()];
        const states = itemKeys.map((itemKey) => {
          const selected = selectedByItem.get(itemKey);
          return selected
            ? evaluateCertificationForProduct(
                requirement,
                selected.product,
                profile,
                currentDate,
              )
            : TenderRequirementState.UNKNOWN;
        });
        const state = states.includes(TenderRequirementState.UNSATISFIED)
          ? TenderRequirementState.UNSATISFIED
          : states.length &&
              states.every((item) => item === TenderRequirementState.SATISFIED)
            ? TenderRequirementState.SATISFIED
            : TenderRequirementState.UNKNOWN;
        return {
          requirementId: requirement.id,
          state,
          required: requirement.required,
          evidenceIds: requirement.evidenceIds,
        };
      },
    );

    const participationResults = requirements.participationConditions.map(
      (condition) => ({
        requirementId: condition.id,
        state: evaluateParticipation(condition, profile, now),
        required: condition.required,
        evidenceIds: condition.evidenceIds,
      }),
    );

    const satisfiedCount = specificationResults.filter(
      ({ state }) => state === TenderRequirementState.SATISFIED,
    ).length;
    const unsatisfiedCount = specificationResults.filter(
      ({ state }) => state === TenderRequirementState.UNSATISFIED,
    ).length;
    const unknownCount = specificationResults.filter(
      ({ state }) => state === TenderRequirementState.UNKNOWN,
    ).length;
    const totalCount = specificationResults.length;
    const weighted = specificationResults.reduce(
      (totals, result) => {
        if (result.state === TenderRequirementState.UNKNOWN) return totals;
        const weight = result.required ? 2 : 1;
        totals.total += weight;
        if (result.state === TenderRequirementState.SATISFIED)
          totals.satisfied += weight;
        return totals;
      },
      { total: 0, satisfied: 0 },
    );
    const exactSpecificationScore = weighted.total
      ? (weighted.satisfied / weighted.total) * 100
      : null;
    const specificationScore =
      exactSpecificationScore === null
        ? null
        : Math.round(exactSpecificationScore);
    const qualificationResults = [
      ...certificationResults,
      ...participationResults,
    ];
    const hardFailure = qualificationResults.some(
      ({ required, state }) =>
        required && state === TenderRequirementState.UNSATISFIED,
    );
    const hasUnknown =
      unknownCount > 0 ||
      qualificationResults.some(
        ({ state }) => state === TenderRequirementState.UNKNOWN,
      ) ||
      requirements.evidence.some(({ state }) => state === "UNKNOWN");
    const suitability = hardFailure
      ? TenderSuitability.DIFFICULT
      : hasUnknown || specificationScore === null
        ? TenderSuitability.REVIEW
        : exactSpecificationScore! < 50
          ? TenderSuitability.DIFFICULT
          : exactSpecificationScore! < 80
            ? TenderSuitability.REVIEW
            : TenderSuitability.RECOMMENDED;

    return {
      suitability,
      specificationScore,
      satisfiedCount,
      unsatisfiedCount,
      unknownCount,
      totalCount,
      certifications: certificationResults,
      participationConditions: participationResults,
      evidence: requirements.evidence,
      inputFingerprints: resultFingerprintInputs(
        requirements,
        profile,
        products,
      ),
    };
  }
}

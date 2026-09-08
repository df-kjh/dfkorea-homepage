import { ParsedTenderRequirements } from "./tender-requirement";
import { TenderAwardResult } from "../entities/tender-award-result.entity";
export interface TenderPricingContext {
  source: "G2B" | "KAPT" | "LH";
  contractKind: "TOTAL" | "UNIT" | "MIXED" | "UNKNOWN";
  currency: "KRW" | "UNKNOWN";
  formulaKind: "STANDARD" | "A_VALUE" | "SPECIAL" | "UNKNOWN";
  aValue?: string;
  awardMethod?: string;
  region?: string;
  productGroup?: string;
  now: Date;
}
export type TenderPriceRequirements = ParsedTenderRequirements & {
  pricingContext?: TenderPricingContext;
};
import { Injectable } from "@nestjs/common";
import { TenderDecimal as D, positiveDecimal } from "./tender-decimal";
import { monthlyAwardWindows } from "./tender-award-window";
export type PriceConfidence = "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH";
export type PriceMatchingLevel =
  | "ITEM_METHOD_REGION"
  | "ITEM_METHOD"
  | "LED_GROUP_METHOD"
  | null;
interface RateSummary {
  median: string;
  p25: string;
  p75: string;
}
export interface TenderPriceAnalysis {
  official: {
    status: "AVAILABLE" | "FORMULA_REVIEW_REQUIRED";
    minimum?: string;
    maximum?: string;
    formulaKind?: string;
  };
  statistics: {
    status: "AVAILABLE" | "INSUFFICIENT_SAMPLES" | "INCOMPARABLE_CONTRACT";
    confidence: PriceConfidence;
    sampleCount: number;
    excludedCount: number;
    matchingLevel: PriceMatchingLevel;
    period: { start: string; end: string } | null;
    estimatedPrice: string | null;
    minimum?: string;
    maximum?: string;
    adjustmentRate?: RateSummary;
    winningRate?: RateSummary;
  };
}
type PriceAward = Partial<TenderAwardResult> & {
  contractKind?: "TOTAL" | "UNIT" | "MIXED";
  currency?: string;
};
type Sample = { award: PriceAward; adjustment: D; winning: D };
const HUNDRED = D.integer(100);
const quartile = (values: D[], quarter: number): D => {
  const sorted = [...values].sort((a, b) => a.compare(b));
  const position = (sorted.length - 1) * quarter;
  const index = Math.floor(position / 4),
    remainder = position % 4;
  return remainder
    ? sorted[index].add(
        sorted[index + 1]
          .subtract(sorted[index])
          .multiply(D.integer(remainder))
          .divide(D.integer(4)),
      )
    : sorted[index];
};
const summary = (values: D[]): RateSummary => ({
  p25: quartile(values, 1).toString(),
  median: quartile(values, 2).toString(),
  p75: quartile(values, 3).toString(),
});
const fence = (values: D[]) => {
  const q1 = quartile(values, 1),
    q3 = quartile(values, 3),
    spread = q3.subtract(q1).multiply(D.integer(3)).divide(D.integer(2));
  return { low: q1.subtract(spread), high: q3.add(spread) };
};
const filterOutliers = (samples: Sample[]): Sample[] => {
  if (!samples.length) return [];
  const a = fence(samples.map((s) => s.adjustment)),
    w = fence(samples.map((s) => s.winning));
  return samples.filter(
    (s) =>
      s.adjustment.compare(a.low) >= 0 &&
      s.adjustment.compare(a.high) <= 0 &&
      s.winning.compare(w.low) >= 0 &&
      s.winning.compare(w.high) <= 0,
  );
};
@Injectable()
export class TenderPriceAnalyzer {
  analyze(
    requirements: TenderPriceRequirements,
    awards: PriceAward[],
  ): TenderPriceAnalysis {
    const context = requirements.pricingContext;
    const windows = context ? monthlyAwardWindows(context.now) : [];
    const period = windows.length
      ? { start: windows[0].start, end: windows.at(-1)!.end }
      : null;
    const official = this.official(requirements);
    const statistics: TenderPriceAnalysis["statistics"] = {
      status: "INSUFFICIENT_SAMPLES",
      confidence: "INSUFFICIENT",
      sampleCount: 0,
      excludedCount: 0,
      matchingLevel: null,
      period,
      estimatedPrice: null,
    };
    if (
      !context ||
      context.contractKind !== "TOTAL" ||
      context.currency !== "KRW" ||
      requirements.items.length !== 1
    ) {
      statistics.status = "INCOMPARABLE_CONTRACT";
      return { official, statistics };
    }
    const basis = positiveDecimal(requirements.bidFormula.basisAmount);
    if (!basis || !context.awardMethod) return { official, statistics };
    const seen = new Set<string>();
    const candidates: Sample[] = awards.flatMap((award) => {
      if (
        award.source !== context.source ||
        award.awardMethod !== context.awardMethod ||
        award.isFinalAward !== true ||
        award.isFailedBid !== false ||
        (award.contractKind && award.contractKind !== "TOTAL") ||
        (award.currency && award.currency !== "KRW") ||
        !(award.openedAt instanceof Date)
      )
        return [];
      const opened = award.openedAt.getTime();
      if (!Number.isFinite(opened)) return [];
      if (
        opened < new Date(`${period.start}T00:00:00+09:00`).getTime() ||
        opened > context.now.getTime()
      )
        return [];
      const identity = JSON.stringify([
        award.source,
        award.sourceNoticeId,
        award.revision,
        award.productClassification,
        opened,
      ]);
      if (seen.has(identity)) return [];
      const historicalBasis = positiveDecimal(award.basisAmount),
        expected = positiveDecimal(award.expectedPrice),
        winning = positiveDecimal(award.winningAmount);
      if (!historicalBasis || !expected || !winning) return [];
      seen.add(identity);
      return [
        {
          award,
          adjustment: expected.divide(historicalBasis),
          winning: winning.divide(expected),
        },
      ];
    });
    const item = requirements.items[0].classificationCode;
    const levels: {
      level: PriceMatchingLevel;
      test: (s: Sample) => boolean;
    }[] = [
      {
        level: "ITEM_METHOD_REGION",
        test: (s) =>
          !!item &&
          !!context.region &&
          s.award.productClassification === item &&
          s.award.region === context.region,
      },
      {
        level: "ITEM_METHOD",
        test: (s) => !!item && s.award.productClassification === item,
      },
      {
        level: "LED_GROUP_METHOD",
        test: (s) =>
          context.productGroup === "LED" && s.award.productGroup === "LED",
      },
    ];
    let selected: Sample[] = [];
    for (const level of levels) {
      const matching = candidates.filter(level.test),
        filtered = filterOutliers(matching);
      if (filtered.length >= selected.length) {
        selected = filtered;
        statistics.matchingLevel = level.level;
        statistics.excludedCount = matching.length - filtered.length;
      }
      if (filtered.length >= 15) break;
    }
    statistics.sampleCount = selected.length;
    if (selected.length < 15) return { official, statistics };
    statistics.status = "AVAILABLE";
    statistics.confidence =
      selected.length >= 100
        ? "HIGH"
        : selected.length >= 30
          ? "MEDIUM"
          : "LOW";
    const adjustments = selected.map((s) => s.adjustment),
      winning = selected.map((s) => s.winning);
    statistics.adjustmentRate = summary(adjustments);
    statistics.winningRate = summary(winning);
    // Keep the exact rational quartiles for products; the displayed ratio's
    // decimal serialization must never feed back into monetary computation.
    statistics.estimatedPrice = basis
      .multiply(quartile(adjustments, 2))
      .multiply(quartile(winning, 2))
      .toString();
    statistics.minimum = basis
      .multiply(quartile(adjustments, 1))
      .multiply(quartile(winning, 1))
      .toString();
    statistics.maximum = basis
      .multiply(quartile(adjustments, 3))
      .multiply(quartile(winning, 3))
      .toString();
    return { official, statistics };
  }
  private official(
    requirements: TenderPriceRequirements,
  ): TenderPriceAnalysis["official"] {
    const review: TenderPriceAnalysis["official"] = {
      status: "FORMULA_REVIEW_REQUIRED",
    };
    const context = requirements.pricingContext,
      formula = requirements.bidFormula;
    if (
      !context ||
      context.contractKind !== "TOTAL" ||
      context.currency !== "KRW" ||
      requirements.items.length !== 1 ||
      !["STANDARD", "A_VALUE"].includes(context.formulaKind)
    )
      return review;
    const basis = positiveDecimal(formula.basisAmount),
      lower = positiveDecimal(formula.lowerLimitRate);
    if (!basis || !lower || lower.compare(HUNDRED) > 0) return review;
    if (formula.evaluationBasisAmount !== undefined) {
      const evaluationBasis = positiveDecimal(formula.evaluationBasisAmount);
      if (!evaluationBasis || evaluationBasis.compare(basis) !== 0)
        return review;
    }
    // Known special calculation methods are never treated as ordinary reserve
    // ranges even if a caller supplied STANDARD without examining the evidence.
    if (
      [formula.reservePriceMethod, formula.plannedPriceMethod].some(
        (method) => method && !/^(?:복수예비가격|복수예가)$/.test(method),
      )
    )
      return review;
    let minimum = D.parse(formula.reservePriceMinimumRate),
      maximum = D.parse(formula.reservePriceMaximumRate);
    if (!minimum || !maximum) {
      if (
        formula.reservePriceMinimumRate !== undefined ||
        formula.reservePriceMaximumRate !== undefined ||
        context.source !== "G2B"
      )
        return review;
      const range =
        formula.lawKind === "NATIONAL"
          ? 2
          : formula.lawKind === "LOCAL"
            ? 3
            : null;
      if (range === null) return review;
      minimum = D.integer(100 - range);
      maximum = D.integer(100 + range);
    }
    const minAdjustment = minimum.divide(HUNDRED),
      maxAdjustment = maximum.divide(HUNDRED);
    if (!minAdjustment.positive || minimum.compare(maximum) > 0) return review;
    const a =
      context.formulaKind === "A_VALUE"
        ? D.parse(context.aValue)
        : D.integer(0);
    if (
      !a ||
      a.compare(D.integer(0)) < 0 ||
      a.compare(basis.multiply(minAdjustment)) >= 0
    )
      return review;
    const price = (adjustment: D) =>
      basis
        .multiply(adjustment)
        .subtract(a)
        .multiply(lower.divide(HUNDRED))
        .add(a)
        .toString();
    return {
      status: "AVAILABLE",
      minimum: price(minAdjustment),
      maximum: price(maxAdjustment),
      formulaKind: context.formulaKind,
    };
  }
}

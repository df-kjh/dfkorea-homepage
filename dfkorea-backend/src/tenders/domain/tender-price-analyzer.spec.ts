import { parseBidFormulaText } from "./tender-requirement-parser";
import {
  TenderPriceAnalyzer,
  TenderPriceRequirements,
} from "./tender-price-analyzer";
import { TenderAwardResult } from "../entities/tender-award-result.entity";
const analyzer = new TenderPriceAnalyzer();
const requirements = (): TenderPriceRequirements => ({
  items: [
    {
      key: "one",
      classificationCode: "3911210201",
      specifications: [],
      evidenceIds: [],
    },
  ],
  certifications: [],
  participationConditions: [],
  evidence: [],
  fingerprint: "fixture",
  bidFormula: {
    basisAmount: "100000000",
    lowerLimitRate: "88",
    lawKind: "NATIONAL",
  },
  pricingContext: {
    source: "G2B",
    contractKind: "TOTAL",
    currency: "KRW",
    formulaKind: "STANDARD",
    awardMethod: "적격심사",
    region: "11",
    productGroup: "LED",
    now: new Date("2026-09-07T03:00:00Z"),
  },
});
const awards = (count: number): Partial<TenderAwardResult>[] =>
  Array.from({ length: count }, (_, i) => ({
    source: "G2B",
    sourceNoticeId: `n${i}`,
    revision: "000",
    productClassification: "3911210201",
    productGroup: "LED",
    awardMethod: "적격심사",
    region: "11",
    basisAmount: "100000000",
    expectedPrice: "99820000",
    winningAmount: "88700052",
    openedAt: new Date("2026-09-01T01:00:00Z"),
    isFinalAward: true,
    isFailedBid: false,
  }));
describe("TenderPriceAnalyzer", () => {
  it("computes exact official and hand-calculated statistical prices before display rounding", () => {
    const result = analyzer.analyze(requirements(), awards(30));
    expect(result.official).toEqual({
      status: "AVAILABLE",
      minimum: "86240000",
      maximum: "89760000",
      formulaKind: "STANDARD",
    });
    expect(result.statistics).toMatchObject({
      status: "AVAILABLE",
      estimatedPrice: "88700052",
      minimum: "88700052",
      maximum: "88700052",
      adjustmentRate: { median: "0.9982", p25: "0.9982", p75: "0.9982" },
      winningRate: { median: "0.8886", p25: "0.8886", p75: "0.8886" },
      sampleCount: 30,
      matchingLevel: "ITEM_METHOD_REGION",
      confidence: "MEDIUM",
      period: { start: "2024-09-07", end: "2026-09-07" },
    });
  });
  it.each([
    [14, "INSUFFICIENT"],
    [15, "LOW"],
    [29, "LOW"],
    [30, "MEDIUM"],
    [99, "MEDIUM"],
    [100, "HIGH"],
  ])("applies exact %i sample boundary", (count, confidence) => {
    const stats = analyzer.analyze(
      requirements(),
      awards(count as number),
    ).statistics;
    expect(stats.confidence).toBe(confidence);
    expect(stats.sampleCount).toBe(count);
    expect(stats.status).toBe(
      count === 14 ? "INSUFFICIENT_SAMPLES" : "AVAILABLE",
    );
    if (count === 14) expect(stats.estimatedPrice).toBeNull();
  });
  it("uses linearly interpolated quartiles and removes IQR outliers on both dimensions", () => {
    const rows = awards(20);
    rows.push({
      ...rows[0],
      sourceNoticeId: "outlier",
      expectedPrice: "200000000",
      winningAmount: "10000000",
    });
    expect(analyzer.analyze(requirements(), rows).statistics).toMatchObject({
      sampleCount: 20,
      excludedCount: 1,
    });
    const varied = awards(16).map((row, i) => ({
      ...row,
      expectedPrice: String(90000000 + i * 1000000),
      winningAmount: String((90000000 + i * 1000000) * 0.9),
    }));
    expect(
      analyzer.analyze(requirements(), varied).statistics.adjustmentRate,
    ).toEqual({ p25: "0.9375", median: "0.975", p75: "1.0125" });
  });
  it("widens matching only when the narrower level lacks 15 post-IQR samples", () => {
    const rows = awards(14).concat(
      awards(2).map((row, i) => ({
        ...row,
        sourceNoticeId: `other${i}`,
        region: "41",
      })),
      awards(30).map((row, i) => ({
        ...row,
        sourceNoticeId: `group${i}`,
        productClassification: "3911210202",
      })),
    );
    expect(analyzer.analyze(requirements(), rows).statistics).toMatchObject({
      matchingLevel: "ITEM_METHOD",
      sampleCount: 16,
    });
    expect(
      analyzer.analyze(requirements(), rows.slice(14)).statistics,
    ).toMatchObject({ matchingLevel: "LED_GROUP_METHOD", sampleCount: 32 });
  });
  it.each(["UNIT", "MIXED", "UNKNOWN"] as const)(
    "rejects %s contracts",
    (contractKind) => {
      const req = requirements();
      req.pricingContext.contractKind = contractKind;
      expect(analyzer.analyze(req, awards(100))).toMatchObject({
        official: { status: "FORMULA_REVIEW_REQUIRED" },
        statistics: { status: "INCOMPARABLE_CONTRACT" },
      });
    },
  );
  it("requires all supported official variables, including A-value and contract evidence", () => {
    const req = requirements();
    req.pricingContext.formulaKind = "A_VALUE";
    expect(analyzer.analyze(req, []).official.status).toBe(
      "FORMULA_REVIEW_REQUIRED",
    );
    req.pricingContext.aValue = "1000000";
    expect(analyzer.analyze(req, []).official).toMatchObject({
      minimum: "86360000",
      maximum: "89880000",
    });
    req.pricingContext.formulaKind = "SPECIAL";
    expect(analyzer.analyze(req, []).official.status).toBe(
      "FORMULA_REVIEW_REQUIRED",
    );
    delete req.pricingContext;
    expect(analyzer.analyze(req, []).official.status).toBe(
      "FORMULA_REVIEW_REQUIRED",
    );
  });
  it("uses explicit reserve bounds and never applies G2B law defaults to K-apt", () => {
    const req = requirements();
    req.bidFormula.reservePriceMinimumRate = "98.5";
    req.bidFormula.reservePriceMaximumRate = "101.5";
    expect(analyzer.analyze(req, []).official).toMatchObject({
      minimum: "86680000",
      maximum: "89320000",
    });
    req.pricingContext.source = "KAPT";
    delete req.bidFormula.reservePriceMinimumRate;
    delete req.bidFormula.reservePriceMaximumRate;
    expect(analyzer.analyze(req, []).official.status).toBe(
      "FORMULA_REVIEW_REQUIRED",
    );
  });
  it("excludes failed, nonpositive, out-of-period, duplicate and foreign-source samples", () => {
    const rows = awards(15);
    const bad = [
      { ...rows[0] },
      { ...rows[0], sourceNoticeId: "failed", isFailedBid: true },
      { ...rows[0], sourceNoticeId: "zero", basisAmount: "0" },
      { ...rows[0], sourceNoticeId: "old", openedAt: new Date("2024-01-01") },
      { ...rows[0], sourceNoticeId: "foreign", source: "KAPT" },
    ];
    expect(
      analyzer.analyze(requirements(), rows.concat(bad)).statistics.sampleCount,
    ).toBe(15);
  });
  it("preserves arbitrary-precision multiplication for large monetary values", () => {
    const req = requirements();
    req.bidFormula.basisAmount = "9007199254740993.01";
    req.bidFormula.lowerLimitRate = "100";
    req.bidFormula.reservePriceMinimumRate = "100";
    req.bidFormula.reservePriceMaximumRate = "100";
    expect(analyzer.analyze(req, []).official.minimum).toBe(
      "9007199254740993.01",
    );
  });
});

it("rejects a differing evaluation basis and invalid historical dates", () => {
  const req = requirements();
  req.bidFormula.evaluationBasisAmount = "99000000";
  expect(analyzer.analyze(req, []).official.status).toBe(
    "FORMULA_REVIEW_REQUIRED",
  );
  const rows = awards(15);
  rows[0].openedAt = new Date("invalid");
  expect(analyzer.analyze(requirements(), rows).statistics.sampleCount).toBe(
    14,
  );
});

describe("document reserve percentages", () => {
  it.each(["98% 이상 102% 이하", "-2% 이상 +2% 이하"])(
    "uses exact absolute prices for %s",
    (range) => {
      const input = requirements();
      input.bidFormula = {
        ...input.bidFormula,
        ...parseBidFormulaText(`기초금액의 ${range}`, "doc"),
      };
      expect(input.bidFormula).toMatchObject({
        reservePriceMinimumRate: "98",
        reservePriceMaximumRate: "102",
      });
      expect(analyzer.analyze(input, []).official).toMatchObject({
        status: "AVAILABLE",
        minimum: "86240000",
        maximum: "89760000",
      });
    },
  );
  it.each(["-2% 이상 102% 이하", "98% 이상 +2% 이하", "-2% 이상 2% 이하"])(
    "rejects mixed representation %s",
    (range) => {
      const input = requirements();
      input.bidFormula = {
        ...input.bidFormula,
        ...parseBidFormulaText(`기초금액의 ${range}`, "doc"),
      };
      expect(analyzer.analyze(input, []).official.status).toBe(
        "FORMULA_REVIEW_REQUIRED",
      );
    },
  );
});

import { Injectable } from "@nestjs/common";
import { TenderRelevance } from "./tender.enums";

export type TenderClassificationField =
  | "title"
  | "itemName"
  | "description"
  | "attachmentNames";

export interface TenderClassificationInput {
  title: string;
  itemName: string;
  description: string;
  attachmentNames: string[];
}

export interface TenderClassificationReason {
  field: TenderClassificationField;
  keyword: string;
  score: number;
}

export interface TenderClassification {
  relevance: TenderRelevance;
  score: number;
  reasons: TenderClassificationReason[];
}

interface ClassificationRule {
  keyword: string;
  score: number;
}

const DIRECT_SCORE = 100;
const POTENTIAL_SCORE = 40;

const DIRECT_RULES: readonly ClassificationRule[] = [
  "LED",
  "조명",
  "등기구",
  "가로등",
  "보안등",
  "투광등",
  "경관조명",
  "실내조명",
  "조명제어",
].map((keyword) => ({
  keyword,
  score: DIRECT_SCORE,
}));

const POTENTIAL_RULES: readonly ClassificationRule[] = [
  "전기공사",
  "전기시설",
  "전기설비",
  "시설개선",
  "리모델링",
  "에너지 절감",
  "주차장 개선",
  "스마트시티",
].map((keyword) => ({
  keyword,
  score: POTENTIAL_SCORE,
}));

const CLASSIFICATION_RULES = [...DIRECT_RULES, ...POTENTIAL_RULES];

// These are deliberately full product phrases rather than broad terms such as
// "전광판". A generic exclusion could hide a genuine lighting tender that also
// mentions a signboard, while these phrases identify LED display products.
const EXCLUSION_PHRASES = ["LED 전광판", "LED 디스플레이"];

@Injectable()
export class TenderClassifier {
  classify(tender: TenderClassificationInput): TenderClassification | null {
    const searchableFields = this.getSearchableFields(tender);

    if (this.hasExcludedPhrase(searchableFields)) {
      return null;
    }

    const reasons = this.collectReasons(searchableFields);

    if (reasons.length === 0) {
      return null;
    }

    const score = reasons.reduce((total, reason) => total + reason.score, 0);
    // Several potential matches can exceed 100 points, but they must not be
    // promoted to direct relevance without at least one direct keyword.
    const relevance = reasons.some((reason) => reason.score === DIRECT_SCORE)
      ? TenderRelevance.DIRECT
      : TenderRelevance.POTENTIAL;

    return { relevance, score, reasons };
  }

  private collectReasons(
    searchableFields: readonly [TenderClassificationField, string][],
  ): TenderClassificationReason[] {
    return searchableFields.flatMap(([field, value]) =>
      CLASSIFICATION_RULES.filter((rule) =>
        this.includes(value, rule.keyword),
      ).map((rule) => ({ field, keyword: rule.keyword, score: rule.score })),
    );
  }

  private getSearchableFields(
    tender: TenderClassificationInput,
  ): readonly [TenderClassificationField, string][] {
    return [
      ["title", tender.title],
      ["itemName", tender.itemName],
      ["description", tender.description],
      ["attachmentNames", tender.attachmentNames.join(" ")],
    ];
  }

  private hasExcludedPhrase(
    searchableFields: readonly [TenderClassificationField, string][],
  ): boolean {
    return searchableFields.some(([, value]) =>
      EXCLUSION_PHRASES.some((phrase) => this.includes(value, phrase)),
    );
  }

  private includes(value: string, keyword: string): boolean {
    return this.normalizeWhitespace(value)
      .toLowerCase()
      .includes(this.normalizeWhitespace(keyword).toLowerCase());
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }
}

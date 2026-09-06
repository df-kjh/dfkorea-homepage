import { Transform } from "class-transformer";
import { IsBoolean, IsString, Matches, MaxLength } from "class-validator";
import {
  TenderAnalysisStatus,
  TenderSuitability,
} from "../domain/tender-analysis.enums";

export class SaveTenderAnalysisReviewDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  analysisFingerprint: string;

  @IsBoolean()
  completed: boolean;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  note: string = "";
}

export interface TenderAnalysisSummaryDto {
  status: TenderAnalysisStatus;
  suitability: TenderSuitability | null;
  specificationScore: number | null;
  unknownCount: number;
  analyzedAt: Date | null;
}

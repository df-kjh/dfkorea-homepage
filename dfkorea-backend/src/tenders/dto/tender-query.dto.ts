import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import {
  ProcurementType,
  TenderRelevance,
  TenderSource,
  TenderOpportunityType,
} from "../domain/tender.enums";
import type { TenderClassificationReason } from "../domain/tender-classifier";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class TenderFilterQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  keyword?: string;

  @IsOptional()
  @IsEnum(TenderSource)
  source?: TenderSource;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  region?: string;

  @IsOptional()
  @IsEnum(ProcurementType)
  procurementType?: ProcurementType;

  @IsOptional()
  @IsEnum(TenderRelevance)
  relevance?: TenderRelevance;
}

export class TenderCalendarQueryDto extends TenderFilterQueryDto {
  @IsString()
  @Matches(MONTH_PATTERN)
  month: string;
}

export class TenderListQueryDto extends TenderFilterQueryDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_PATTERN)
  registeredDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export interface TenderCalendarDayDto {
  date: string;
  total: number;
  direct: number;
  potential: number;
}

export interface TenderSummaryDto {
  id: string;
  source: TenderSource;
  sourceNoticeId: string;
  revision: string;
  title: string;
  orderingOrganization: string;
  demandOrganization: string | null;
  registeredAt: Date;
  bidStartedAt: Date | null;
  bidEndedAt: Date | null;
  openedAt: Date | null;
  region: string | null;
  procurementType: ProcurementType;
  contractMethod: string | null;
  estimatedAmount: string | null;
  sourceUrl: string;
  relevance: TenderRelevance;
  relevanceScore: number;
  relevanceReasons: TenderClassificationReason[];
  opportunityType: TenderOpportunityType;
  opportunityReasons: string[];
}

export type TenderDetailDto = TenderSummaryDto;

export interface PaginatedTenderDto {
  data: TenderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

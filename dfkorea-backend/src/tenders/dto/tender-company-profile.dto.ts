import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsString,
  Matches,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const NON_EMPTY_TEXT = /\S/;
const BUSINESS_NUMBER = /^\d{10}$/;
const DECIMAL_STRING = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const trimText = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const normalizeCode = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

@ValidatorConstraint({ name: "notExpiredTenderQualification", async: false })
class NotExpiredTenderQualificationConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(value).getTime() >= today.getTime();
  }

  defaultMessage(): string {
    return "expiresAt must not be in the past";
  }
}

@ValidatorConstraint({ name: "performancePeriod", async: false })
class PerformancePeriodConstraint implements ValidatorConstraintInterface {
  validate(to: unknown, arguments_: ValidationArguments): boolean {
    const record = arguments_.object as TenderCompanyPerformanceRecordDto;
    if (typeof record.from !== "string" || typeof to !== "string") {
      return true;
    }
    return Date.parse(record.from) <= Date.parse(to);
  }

  defaultMessage(): string {
    return "to must be on or after from";
  }
}

export class TenderCompanyHeadquartersDto {
  @Transform(trimText)
  @IsString()
  @Matches(NON_EMPTY_TEXT)
  sido: string;

  @Transform(trimText)
  @IsString()
  @Matches(NON_EMPTY_TEXT)
  sigungu: string;
}

export class TenderCompanyQualificationDto {
  @Transform(normalizeCode)
  @IsString()
  @Matches(NON_EMPTY_TEXT)
  code: string;

  @Transform(trimText)
  @IsString()
  @Matches(NON_EMPTY_TEXT)
  name: string;

  // A missing expiry is ambiguous for suitability analysis. Administrators
  // must choose either a concrete ISO date or explicit null for no expiry.
  @ValidateIf((_object, value) => value !== null)
  @IsDateString()
  @Validate(NotExpiredTenderQualificationConstraint)
  expiresAt: string | null;
}

export class TenderCompanyPerformanceRecordDto {
  @Transform(trimText)
  @IsString()
  @Matches(NON_EMPTY_TEXT)
  itemName: string;

  @IsDateString()
  from: string;

  @IsDateString()
  @Validate(PerformancePeriodConstraint)
  to: string;

  @Transform(trimText)
  @IsString()
  @Matches(DECIMAL_STRING)
  amount: string;
}

export class ReplaceTenderCompanyProfileDto {
  @Transform(trimText)
  @IsString()
  @Matches(NON_EMPTY_TEXT)
  companyName: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : value,
  )
  @IsString()
  @Matches(BUSINESS_NUMBER)
  businessNumber: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => TenderCompanyHeadquartersDto)
  headquarters: TenderCompanyHeadquartersDto;

  @IsBoolean()
  g2bRegistered: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.code.trim(),
  )
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.name.trim(),
  )
  @ValidateNested({ each: true })
  @Type(() => TenderCompanyQualificationDto)
  supplyProducts: TenderCompanyQualificationDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.code.trim(),
  )
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.name.trim(),
  )
  @ValidateNested({ each: true })
  @Type(() => TenderCompanyQualificationDto)
  licenses: TenderCompanyQualificationDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.code.trim(),
  )
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.name.trim(),
  )
  @ValidateNested({ each: true })
  @Type(() => TenderCompanyQualificationDto)
  companyTypes: TenderCompanyQualificationDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.code.trim(),
  )
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.name.trim(),
  )
  @ValidateNested({ each: true })
  @Type(() => TenderCompanyQualificationDto)
  directProduction: TenderCompanyQualificationDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.code.trim(),
  )
  @ArrayUnique((qualification: TenderCompanyQualificationDto) =>
    qualification.name.trim(),
  )
  @ValidateNested({ each: true })
  @Type(() => TenderCompanyQualificationDto)
  certifications: TenderCompanyQualificationDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TenderCompanyPerformanceRecordDto)
  performanceRecords: TenderCompanyPerformanceRecordDto[];
}

export interface TenderCompanyProfileDto
  extends ReplaceTenderCompanyProfileDto {
  version: number;
}

import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsDateString,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
const Trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));
export class BusinessDto {
  @IsString() @Trim() @IsNotEmpty() @MaxLength(100) companyName: string;
  @IsString() @Matches(/^\d{10}$/) businessNumber: string;
  @IsString() @Trim() @IsNotEmpty() @MaxLength(100) representativeName: string;
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  openingDate: string;
}
export class VerificationDto extends BusinessDto {
  @IsString() @Length(1, 100) consentVersion: string;
}
export class CompanyDto extends BusinessDto {
  @IsString() @Trim() @IsNotEmpty() @MaxLength(50) contactName: string;
  @IsEmail() @Trim() @MaxLength(254) email: string;
  @IsOptional() @IsString() @Matches(/^[+\d][\d ()-]{6,24}$/) phone?: string;
}
export class QuoteItemDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,80}$/) clientId: string;
  @IsIn(["catalog", "custom"]) kind: "catalog" | "custom";
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() @Trim() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsInt() @Min(1) @Max(999999) quantity: number;
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(1000000)
  power?: number;
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(1000000)
  colorTemp?: number;
  @IsOptional() @IsString() @MaxLength(300) dimensions?: string;
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  certifications: string[];
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  options: string[];
  @IsOptional()
  @IsString()
  @Trim()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  attachmentIds: string[];
}
export class QuoteSubmissionDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{16,100}$/) idempotencyKey: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) verificationToken: string;
  @IsDefined() @ValidateNested() @Type(() => CompanyDto) company: CompanyDto;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  requestedDeliveryDate?: string;
  @IsString() @Length(1, 100) consentVersion: string;
}
export class QuoteRetryDto {
  @Equals(true) acknowledgeDuplicateRisk: boolean;
  @IsString() @Trim() @Length(5, 500) reason: string;
}

export class QuoteAttachmentUploadDto {
  @IsUUID("4") clientAttachmentId: string;
}

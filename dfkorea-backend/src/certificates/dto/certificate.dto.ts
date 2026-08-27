import {
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateCertificateDto {
  @IsString()
  @IsNotEmpty()
  name: string; // 인증서 이름

  @IsString()
  @IsNotEmpty()
  issuingOrganization: string; // 인증 업체

  @IsString()
  @IsOptional()
  category?: string; // 구분

  @IsString()
  @IsOptional()
  markImage?: string; // 인증 마크 이미지 URL

  @IsString()
  @IsOptional()
  certificatePdf?: string; // 인증서 PDF URL
}

export class UpdateCertificateDto {
  @IsString()
  @IsOptional()
  name?: string; // 인증서 이름

  @IsString()
  @IsOptional()
  issuingOrganization?: string; // 인증 업체

  @IsString()
  @IsOptional()
  category?: string; // 구분

  @IsString()
  @IsOptional()
  markImage?: string; // 인증 마크 이미지 URL

  @IsString()
  @IsOptional()
  certificatePdf?: string; // 인증서 PDF URL
}

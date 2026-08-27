import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ProductImageDto {
  @IsString()
  @IsNotEmpty()
  image: string; // 이미지 URL

  @IsString()
  @IsOptional()
  description?: string; // 이미지 설명 (한 줄)
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string; // 제목

  @IsString()
  @IsNotEmpty()
  category: string; // 카테고리

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsNotEmpty()
  images: ProductImageDto[]; // 제품 썸네일 이미지 (최대 3장)

  @IsString()
  @IsNotEmpty()
  modelName: string; // 모델명

  @IsString()
  @IsNotEmpty()
  dimensions: string; // 크기

  @IsArray()
  @IsNotEmpty()
  power: number[]; // 전력(W) - 여러 개 가능

  @IsNotEmpty()
  lifespan: number; // 수명

  @IsArray()
  @IsNotEmpty()
  colorTemp: number[]; // 색 온도 - 여러 개 가능

  @IsString()
  @IsNotEmpty()
  ledChipManufacturer: string; // LED 칩 제조 회사

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  certifications: string[]; // 인증 (KS, 고효율, 친환경, V-CHECK)

  @IsString()
  @IsOptional()
  powerFactor?: string; // 역률

  @IsOptional()
  luminanceEfficiency?: number; // 광효율

  @IsString()
  @IsOptional()
  colorRendering?: string; // 연색성

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[]; // 옵션 (개별디밍, 그룹디밍, 센서, 발전기 비상, 밧데리 비상)

  @IsString()
  @IsNotEmpty()
  description: string; // 기타 사항 (마크다운)

  @IsBoolean()
  @IsOptional()
  isNew?: boolean; // 신제품 여부

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean; // 메인 제품 여부
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string; // 제목

  @IsString()
  @IsOptional()
  category?: string; // 카테고리

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[]; // 제품 썸네일 이미지 (최대 3장)

  @IsString()
  @IsOptional()
  modelName?: string; // 모델명

  @IsString()
  @IsOptional()
  dimensions?: string; // 크기

  @IsArray()
  @IsOptional()
  power?: number[]; // 전력(W) - 여러 개 가능

  @IsOptional()
  lifespan?: number; // 수명

  @IsArray()
  @IsOptional()
  colorTemp?: number[]; // 색 온도 - 여러 개 가능

  @IsString()
  @IsOptional()
  ledChipManufacturer?: string; // LED 칩 제조 회사

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[]; // 인증 (KS, 고효율, 친환경, V-CHECK)

  @IsString()
  @IsOptional()
  powerFactor?: string; // 역률

  @IsOptional()
  luminanceEfficiency?: number; // 광효율

  @IsString()
  @IsOptional()
  colorRendering?: string; // 연색성

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[]; // 옵션 (개별디밍, 그룹디밍, 센서, 발전기 비상, 밧데리 비상)

  @IsString()
  @IsOptional()
  description?: string; // 기타 사항 (마크다운)

  @IsBoolean()
  @IsOptional()
  isNew?: boolean; // 신제품 여부

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean; // 메인 제품 여부
}

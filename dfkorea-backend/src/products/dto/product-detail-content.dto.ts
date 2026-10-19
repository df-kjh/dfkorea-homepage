import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsObject,
  IsString,
  MaxLength,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import type {
  ProductDetailContent,
  ProductDetailFeature,
  ProductDetailImage,
} from "../product-detail-content";

// Only detailContent itself accepts null as a reset. Optional nested fields
// may be omitted, but null must not silently bypass their type validation.
const isPresent = (_object: unknown, value: unknown) => value !== undefined;

export class ProductDetailImageDto implements ProductDetailImage {
  @IsString()
  @MaxLength(2048)
  @ValidateBy({
    name: "isSafeProductDetailImageUrl",
    validator: {
      validate(value: unknown) {
        if (
          typeof value !== "string" ||
          /[\s\u0000-\u001f\u007f\\]/.test(value)
        ) {
          return false;
        }
        if (value.startsWith("/")) return !value.startsWith("//");
        if (!/^https?:\/\//i.test(value)) return false;
        try {
          const url = new URL(value);
          return (
            Boolean(url.hostname) && ["http:", "https:"].includes(url.protocol)
          );
        } catch {
          return false;
        }
      },
      defaultMessage: () =>
        "$property must be an HTTP(S) URL or a single-root relative path without whitespace or backslashes",
    },
  })
  url: string;

  @IsString()
  @MaxLength(300)
  alt: string;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(500)
  caption?: string;
}

export class ProductDetailFeatureDto implements ProductDetailFeature {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsString()
  @MaxLength(2000)
  body: string;
}

export class ProductDetailApplicationDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ProductDetailImageDto)
  image: ProductDetailImageDto;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(500)
  caption?: string;
}

export class ProductDetailContentDto implements ProductDetailContent {
  @Equals(1)
  version: 1;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(160)
  heroTitle?: string;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(2000)
  heroDescription?: string;

  @ValidateIf(isPresent)
  @IsObject()
  @ValidateNested()
  @Type(() => ProductDetailImageDto)
  heroImage?: ProductDetailImageDto;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(160)
  storyTitle?: string;

  @ValidateIf(isPresent)
  @IsObject()
  @ValidateNested()
  @Type(() => ProductDetailImageDto)
  storyImage?: ProductDetailImageDto;

  @ValidateIf(isPresent)
  @IsArray()
  @ArrayMaxSize(6)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ProductDetailFeatureDto)
  features?: ProductDetailFeatureDto[];

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(160)
  structureTitle?: string;

  @ValidateIf(isPresent)
  @IsArray()
  @ArrayMaxSize(6)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ProductDetailImageDto)
  structureImages?: ProductDetailImageDto[];

  @ValidateIf(isPresent)
  @IsObject()
  @ValidateNested()
  @Type(() => ProductDetailApplicationDto)
  application?: ProductDetailApplicationDto;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(160)
  controlTitle?: string;

  @ValidateIf(isPresent)
  @IsBoolean()
  showControl?: boolean;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(160)
  dimensionsTitle?: string;

  @ValidateIf(isPresent)
  @IsBoolean()
  showDimensions?: boolean;

  @ValidateIf(isPresent)
  @IsObject()
  @ValidateNested()
  @Type(() => ProductDetailImageDto)
  dimensionImage?: ProductDetailImageDto;
}

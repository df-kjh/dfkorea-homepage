import { BadRequestException } from "@nestjs/common";
import { Product } from "../entities/product.entity";

export interface ProductSpecificationFilters {
  power?: number[];
  colorTemp?: number[];
  certifications?: string[];
  options?: string[];
}

export interface ProductFilters extends ProductSpecificationFilters {
  search?: string;
  category?: string;
}

export interface ProductFilterOptions {
  categories: string[];
  power: number[];
  colorTemp: number[];
  certifications: string[];
  options: string[];
}

const readString = (
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined => {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new BadRequestException(
      `${field} must be a string of at most ${maxLength} characters`,
    );
  }
  return value.trim();
};

const readList = (value: unknown, field: string): string[] | undefined => {
  const raw = readString(value, field, 5000);
  if (raw === undefined) return undefined;
  const values = raw.split(",").map((part) => part.trim());
  if (values.length > 50 || values.some((part) => !part || part.length > 100)) {
    throw new BadRequestException(
      `${field} must contain 1 to 50 nonempty comma-separated values (100 characters each)`,
    );
  }
  return [...new Set(values)];
};

const readNumbers = (value: unknown, field: string): number[] | undefined => {
  const values = readList(value, field);
  if (
    values?.some(
      (part) =>
        !/^\d+(?:\.\d+)?$/.test(part) ||
        !Number.isFinite(Number(part)) ||
        Number(part) <= 0 ||
        Number(part) > 1000000,
    )
  ) {
    throw new BadRequestException(
      `${field} values must be positive numbers no greater than 1000000`,
    );
  }
  return values?.map(Number);
};

export const validateProductPagination = (
  page: number,
  limit: number,
): void => {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger((page - 1) * limit)
  ) {
    throw new BadRequestException(
      "page must be a positive safe integer and limit must be an integer from 1 to 100",
    );
  }
};

export const parseProductQuery = (
  query: Record<string, unknown>,
): ProductFilters & { page?: number; limit?: number } => {
  const pageString = readString(query.page, "page", 16);
  const limitString = readString(query.limit, "limit", 3);
  const hasPaging = pageString !== undefined || limitString !== undefined;
  if (
    hasPaging &&
    (pageString === undefined ||
      limitString === undefined ||
      !/^\d+$/.test(pageString) ||
      !/^\d+$/.test(limitString))
  ) {
    throw new BadRequestException(
      "page and limit must be supplied together as positive integers",
    );
  }
  const page = hasPaging ? Number(pageString) : undefined;
  const limit = hasPaging ? Number(limitString) : undefined;
  if (hasPaging) validateProductPagination(page, limit);
  return {
    page,
    limit,
    search: readString(query.search, "search", 200),
    category: readString(query.category, "category", 100),
    power: readNumbers(query.power, "power"),
    colorTemp: readNumbers(query.colorTemp, "colorTemp"),
    certifications: readList(query.certifications, "certifications"),
    options: readList(query.options, "options"),
  };
};

export const filterProducts = (
  products: Product[],
  filters: ProductFilters,
): Product[] => {
  const search = filters.search?.trim().toLowerCase();
  const category = filters.category?.trim();
  const textFilters = {
    certifications: filters.certifications?.map((value) => value.trim()),
    options: filters.options?.map((value) => value.trim()),
  };
  return products.filter((product) => {
    if (
      category &&
      category !== "전체" &&
      product.category?.trim() !== category
    )
      return false;
    if (
      search &&
      ![product.name, product.modelName].some((value) =>
        value?.toLowerCase().includes(search),
      )
    )
      return false;
    // PostgreSQL numeric[]가 문자열 배열로 반환되는 경우에도 수치 기준으로 동일하게 비교한다.
    for (const field of ["power", "colorTemp"] as const) {
      if (
        filters[field]?.length &&
        !(product[field] ?? []).some((value) =>
          filters[field].includes(Number(value)),
        )
      )
        return false;
    }
    for (const field of ["certifications", "options"] as const) {
      if (
        textFilters[field]?.length &&
        !(product[field] ?? []).some((value) =>
          textFilters[field].includes(value.trim()),
        )
      )
        return false;
    }
    return true;
  });
};

export const getProductFilterOptions = (
  products: Product[],
): ProductFilterOptions => {
  const strings = (values: string[]) =>
    [
      ...new Set(
        values
          .filter((value) => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].sort();
  const numbers = (values: number[]) =>
    [
      ...new Set(
        values
          .map(Number)
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    ].sort((a, b) => a - b);
  return {
    categories: strings(products.map((product) => product.category)),
    power: numbers(products.flatMap((product) => product.power ?? [])),
    colorTemp: numbers(products.flatMap((product) => product.colorTemp ?? [])),
    certifications: strings(
      products.flatMap((product) => product.certifications ?? []),
    ),
    options: strings(products.flatMap((product) => product.options ?? [])),
  };
};

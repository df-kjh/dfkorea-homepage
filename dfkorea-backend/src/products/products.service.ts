import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { CreateProductDto } from "./dto/product.dto";
import { UpdateProductDto } from "./dto/product.dto";
import { Product } from "../entities/product.entity";
import {
  filterProducts,
  getProductFilterOptions,
  ProductFilterOptions,
  ProductFilters,
  ProductSpecificationFilters,
  validateProductPagination,
} from "./product-filters";

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(filters: ProductFilters = {}): Promise<Product[]> {
    return filterProducts(await this.databaseService.getProducts(), filters);
  }

  async findFilterOptions(): Promise<ProductFilterOptions> {
    return getProductFilterOptions(await this.databaseService.getProducts());
  }

  async findAllPaginated(
    page: number,
    limit: number,
    search?: string,
    category?: string,
    filters: ProductSpecificationFilters = {},
  ): Promise<{
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    validateProductPagination(page, limit);
    const allProducts = filterProducts(
      await this.databaseService.getProducts(),
      {
        ...filters,
        search,
        category,
      },
    ).sort((a, b) => {
      // 등록 시각이 같아도 페이지 경계의 제품이 조회마다 바뀌지 않도록 ID를 보조 정렬 키로 사용한다.
      const dateOrder =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return dateOrder || a.id.localeCompare(b.id);
    });

    const total = allProducts.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const data = allProducts.slice(startIndex, endIndex);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findFeatured(): Promise<Product[]> {
    const products = await this.databaseService.getProducts();
    return products
      .filter((product) => product.isFeatured === true)
      .slice(0, 4);
  }

  async findOne(id: string): Promise<Product | undefined> {
    const products = await this.databaseService.getProducts();
    return products.find((product) => product.id === id);
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    // TypeORM이 createdAt, updatedAt을 자동 관리합니다
    return this.databaseService.createProduct(createProductDto);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product | null> {
    const product = await this.findOne(id);
    if (!product) {
      return null;
    }

    // TypeORM이 updatedAt을 자동 관리합니다
    return this.databaseService.updateProduct(id, updateProductDto);
  }

  async remove(id: string): Promise<boolean> {
    return this.databaseService.deleteProduct(id);
  }
}

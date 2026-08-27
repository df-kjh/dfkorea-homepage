import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { CreateProductDto } from "./dto/product.dto";
import { UpdateProductDto } from "./dto/product.dto";
import { Product } from "../entities/product.entity";

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<Product[]> {
    return this.databaseService.getProducts();
  }

  async findAllPaginated(
    page: number,
    limit: number,
    search?: string,
    category?: string,
  ): Promise<{
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let allProducts = await this.databaseService.getProducts();

    // 카테고리 필터링
    if (category && category.trim() && category !== "전체") {
      allProducts = allProducts.filter((product) =>
        product.category === category,
      );
    }

    // 검색어가 있으면 필터링
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      allProducts = allProducts.filter((product) =>
        product.name.toLowerCase().includes(searchLower),
      );
    }

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

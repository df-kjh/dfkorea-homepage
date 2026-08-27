import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AiService, ProductInfo } from "../ai/ai.service";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly aiService: AiService,
  ) {}

  @Get()
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("category") category?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    if (pageNum !== undefined && limitNum !== undefined) {
      return this.productsService.findAllPaginated(pageNum, limitNum, search, category);
    }

    return this.productsService.findAll();
  }

  @Get("featured/list")
  async findFeatured() {
    return this.productsService.findFeatured();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const product = await this.productsService.findOne(id);
    if (!product) {
      throw new HttpException("Product not found", HttpStatus.NOT_FOUND);
    }
    return product;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(id, updateProductDto);
    if (!product) {
      throw new HttpException("Product not found", HttpStatus.NOT_FOUND);
    }
    return product;
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string) {
    const success = await this.productsService.remove(id);
    if (!success) {
      throw new HttpException("Product not found", HttpStatus.NOT_FOUND);
    }
    return { message: "Product deleted successfully" };
  }

  @Post("generate-description")
  @UseGuards(JwtAuthGuard)
  async generateDescription(@Body() productInfo: ProductInfo) {
    if (!this.aiService.isAvailable()) {
      throw new HttpException(
        "AI service is not available",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const result =
        await this.aiService.generateProductDescription(productInfo);
      return result;
    } catch (error) {
      throw new HttpException(
        `Failed to generate description: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { DatabaseService } from "../database/database.service";
import { AiService } from "../ai/ai.service";
import { Product } from "../entities/product.entity";
import { Post } from "../entities/post.entity";
import { Admin } from "../entities/admin.entity";
import { Certificate } from "../entities/certificate.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Product, Post, Admin, Certificate])],
  controllers: [ProductsController],
  providers: [ProductsService, DatabaseService, AiService],
  exports: [ProductsService],
})
export class ProductsModule {}

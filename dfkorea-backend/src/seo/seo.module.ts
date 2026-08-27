import { Module } from "@nestjs/common";
import { PostsModule } from "../posts/posts.module";
import { ProductsModule } from "../products/products.module";
import { SeoController } from "./seo.controller";

@Module({
  imports: [PostsModule, ProductsModule],
  controllers: [SeoController],
})
export class SeoModule {}

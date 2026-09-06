import { Module } from "@nestjs/common";
import { PostsModule } from "../posts/posts.module";
import { ProductsModule } from "../products/products.module";
import { CertificatesModule } from "../certificates/certificates.module";
import { SeoController } from "./seo.controller";

@Module({
  imports: [PostsModule, ProductsModule, CertificatesModule],
  controllers: [SeoController],
})
export class SeoModule {}

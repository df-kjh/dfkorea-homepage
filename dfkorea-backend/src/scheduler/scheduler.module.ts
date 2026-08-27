import { Module } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { SchedulerController } from "./scheduler.controller";
import { PostsModule } from "../posts/posts.module";
import { AiModule } from "../ai/ai.module";
import { ProductsModule } from "../products/products.module";

@Module({
  imports: [PostsModule, AiModule, ProductsModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { DatabaseService } from '../database/database.service';
import { Product } from '../entities/product.entity';
import { Post } from '../entities/post.entity';
import { Admin } from '../entities/admin.entity';
import { Certificate } from '../entities/certificate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Post, Admin, Certificate])],
  controllers: [PostsController],
  providers: [PostsService, DatabaseService],
  exports: [PostsService],
})
export class PostsModule {}

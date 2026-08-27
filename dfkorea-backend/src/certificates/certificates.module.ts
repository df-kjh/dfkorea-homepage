import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { DatabaseService } from '../database/database.service';
import { Certificate } from '../entities/certificate.entity';
import { Product } from '../entities/product.entity';
import { Post } from '../entities/post.entity';
import { Admin } from '../entities/admin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate, Product, Post, Admin])],
  controllers: [CertificatesController],
  providers: [CertificatesService, DatabaseService],
  exports: [CertificatesService],
})
export class CertificatesModule {}

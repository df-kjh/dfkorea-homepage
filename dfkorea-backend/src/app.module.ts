import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ProductsModule } from "./products/products.module";
import { PostsModule } from "./posts/posts.module";
import { UploadModule } from "./upload/upload.module";
import { AiModule } from "./ai/ai.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { CertificatesModule } from "./certificates/certificates.module";
import { SeoModule } from "./seo/seo.module";
import { Product } from "./entities/product.entity";
import { Post } from "./entities/post.entity";
import { Admin } from "./entities/admin.entity";
import { Certificate } from "./entities/certificate.entity";
import { DatabaseInitService } from "./database/database-init.service";
import { Tender } from "./tenders/entities/tender.entity";
import { TenderSubscription } from "./tenders/entities/tender-subscription.entity";
import { TenderRecipient } from "./tenders/entities/tender-recipient.entity";
import { TenderSyncRun } from "./tenders/entities/tender-sync-run.entity";
import { TenderMailDelivery } from "./tenders/entities/tender-mail-delivery.entity";
import { TenderMailItem } from "./tenders/entities/tender-mail-item.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === "production"
          ? ".env.production"
          : ".env.development",
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST') || 'localhost',
        port: parseInt(configService.get('DB_PORT') || '5432'),
        username: configService.get('DB_USERNAME') || 'postgres',
        password: configService.get('DB_PASSWORD') || 'postgres',
        database: configService.get('DB_NAME') || 'dfkorea',
        entities: [
          Product,
          Post,
          Admin,
          Certificate,
          Tender,
          TenderSubscription,
          TenderRecipient,
          TenderSyncRun,
          TenderMailDelivery,
          TenderMailItem,
        ],
        // 처음 배포: true, 이후: false로 변경하여 데이터 보호
        synchronize: configService.get('TYPEORM_SYNCHRONIZE') === 'true',
        logging: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Admin]),
    AuthModule,
    ProductsModule,
    PostsModule,
    UploadModule,
    AiModule,
    SchedulerModule,
    CertificatesModule,
    SeoModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseInitService],
})
export class AppModule {}

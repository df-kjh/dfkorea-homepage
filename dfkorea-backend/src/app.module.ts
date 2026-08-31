import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
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
import { TenderDailyDispatch } from "./tenders/entities/tender-daily-dispatch.entity";
import { TenderMailOAuthCredential } from "./tenders/entities/tender-mail-oauth-credential.entity";
import { TendersModule } from "./tenders/tenders.module";
import { resolveDatabaseConnectionOptions } from "./config/production-environment";

export const createApplicationDatabaseOptions = (
  environment: NodeJS.ProcessEnv,
): TypeOrmModuleOptions => ({
  type: "postgres",
  ...resolveDatabaseConnectionOptions(environment),
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
    TenderDailyDispatch,
    TenderMailOAuthCredential,
  ],
  // Shared and production databases are migration-only. Keep this false there;
  // synchronize remains available only for explicitly isolated local work.
  synchronize:
    environment.NODE_ENV === "production"
      ? false
      : environment.TYPEORM_SYNCHRONIZE === "true",
  logging: environment.NODE_ENV !== "production",
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env.development",
      ignoreEnvFile: process.env.NODE_ENV === "production",
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => createApplicationDatabaseOptions(process.env),
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
    TendersModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseInitService],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { DatabaseService } from "../database/database.service";
import { Product } from "../entities/product.entity";
import { Post } from "../entities/post.entity";
import { Admin } from "../entities/admin.entity";
import { Certificate } from "../entities/certificate.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Post, Admin, Certificate]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>("JWT_SECRET") ||
          "your-secret-key-change-this",
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "24h",
        } as any,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, DatabaseService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

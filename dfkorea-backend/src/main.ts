import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS 설정
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  console.log('🔧 Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    isDevelopment
  });
  
  // 기본 허용 origin
  let allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : [
        "http://localhost:5173", 
        "http://localhost:5174",
        "https://dfkorealed.com", // 프로덕션 프론트엔드
      ];

  console.log('🔧 Allowed origins:', allowedOrigins);

  // GitHub Codespaces 환경 감지
  const isCodespaces = process.env.CODESPACES === 'true' || !!process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  
  console.log('🔧 Codespaces detection:', {
    CODESPACES: process.env.CODESPACES,
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN,
    isCodespaces,
    isDevelopment
  });
  
  if (isDevelopment || isCodespaces) {
    if (isCodespaces) {
      // Codespaces 환경: 모든 github.dev 도메인 허용
      console.log('🌐 Detected GitHub Codespaces environment - allowing all *.github.dev domains');
      app.enableCors({
        origin: (origin, callback) => {
          console.log('🔍 CORS request from origin:', origin);
          // origin이 없거나 (같은 도메인) github.dev 도메인이면 허용
          if (!origin || 
              (typeof origin === 'string' && (origin.includes('.github.dev') || origin.includes('localhost')))) {
            console.log('✅ CORS allowed for:', origin);
            callback(null, true);
          } else {
            console.log('❌ CORS blocked for:', origin);
            callback(null, false);
          }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Access-Control-Allow-Origin"],
      });
    } else {
      // 로컬 환경: 설정된 origin만 허용
      app.enableCors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      });
    }
  } else {
    // 프로덕션: origin 함수로 동적 체크
    console.log('🌐 Setting up production CORS...');
    app.enableCors({
      origin: (origin, callback) => {
        console.log('🔍 CORS request from origin:', origin);
        
        // origin이 없으면 허용 (같은 도메인 요청, Postman 등)
        if (!origin) {
          console.log('✅ CORS allowed for same-origin request');
          callback(null, true);
          return;
        }
        
        // allowedOrigins에 정확히 매치되는지 확인
        const isExactMatch = allowedOrigins.includes(origin);
        
        // vercel.app 도메인인지 확인
        const isVercelDomain = origin.endsWith('.vercel.app');
        
        // railway.app 도메인인지 확인
        const isRailwayDomain = origin.endsWith('.railway.app');
        
        const isAllowed = isExactMatch || isVercelDomain || isRailwayDomain;
        
        console.log('🔍 CORS check:', {
          origin,
          isExactMatch,
          isVercelDomain,
          isRailwayDomain,
          isAllowed,
          allowedOrigins
        });
        
        if (isAllowed) {
          console.log('✅ CORS allowed for:', origin);
          callback(null, true);
        } else {
          console.log('❌ CORS blocked for:', origin);
          callback(null, false);
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  }

  console.log("🌐 CORS enabled for:", isCodespaces ? "GitHub Codespaces (*.github.dev)" : (isDevelopment ? allowedOrigins : "Vercel domains"));

  // 정적 파일 서빙 설정 (업로드된 이미지)
  app.useStaticAssets(join(__dirname, "..", "uploads"), {
    prefix: "/uploads/",
  });

  // Validation Pipe 전역 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = process.env.PORT || 3000;
  // Railway, Docker 등 클라우드 환경에서는 0.0.0.0으로 바인딩해야 함
  const host = process.env.NODE_ENV === 'production' || isCodespaces ? '0.0.0.0' : 'localhost';
  
  await app.listen(port, host);
  console.log(`🚀 Application is running on: http://${host}:${port}`);
}
bootstrap();

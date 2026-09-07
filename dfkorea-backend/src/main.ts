import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule, createApplicationDatabaseOptions } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import {
  createCorsOptions,
  httpSecurityHeaders,
} from "./security/http-security";
import { quoteProxyHops } from "./quotes/quote-proxy";
import { maybeWriteTestBootstrapConfigProbe } from "./config/bootstrap-config-probe";

async function bootstrap() {
  if (
    maybeWriteTestBootstrapConfigProbe(
      process.env,
      createApplicationDatabaseOptions(process.env),
    )
  ) {
    return;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 배포 경로의 프록시 수를 검증한 경우에만 전달 IP를 신뢰한다. 임의 XFF는 직접 읽지 않는다.
  const trustedProxyHops = quoteProxyHops(process.env.TRUST_PROXY_HOPS);
  if (trustedProxyHops !== undefined) app.set("trust proxy", trustedProxyHops);

  app.disable("x-powered-by");
  app.use(httpSecurityHeaders(process.env.NODE_ENV === "production"));
  app.enableCors(createCorsOptions(process.env));
  const isCodespaces =
    process.env.CODESPACES === "true" ||
    !!process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

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
    }),
  );

  const port = process.env.PORT || 3000;
  // Railway, Docker 등 클라우드 환경에서는 0.0.0.0으로 바인딩해야 함
  const host =
    process.env.NODE_ENV === "production" || isCodespaces
      ? "0.0.0.0"
      : "localhost";

  await app.listen(port, host);
  console.log(`🚀 Application is running on: http://${host}:${port}`);
}
bootstrap();

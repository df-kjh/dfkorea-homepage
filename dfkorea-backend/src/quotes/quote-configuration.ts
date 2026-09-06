import { createHmac } from "crypto";
import { resolveJwtSecret } from "../config/production-environment";
import { quoteError } from "./quote-policy";

type QuoteConfiguration = { get<T>(key: string): T };

export function quoteIpHashKey(config: QuoteConfiguration): string | Buffer {
  const override = config.get<string>("QUOTE_IP_HASH_SECRET");
  if (override?.trim()) {
    if (override.length < 32)
      quoteError(
        503,
        "QUOTE_CONFIGURATION",
        "온라인 견적 연결 설정을 확인하고 있습니다.",
      );
    // 기존 별도 키를 설정한 서버는 같은 해시를 유지해 진행 중인 요청 제한을 보존한다.
    return override;
  }
  let rootSecret: string;
  try {
    rootSecret = resolveJwtSecret({
      NODE_ENV: config.get<string>("NODE_ENV"),
      JWT_SECRET: config.get<string>("JWT_SECRET"),
    });
  } catch {
    quoteError(
      503,
      "QUOTE_CONFIGURATION",
      "온라인 견적 연결 설정을 확인하고 있습니다.",
    );
  }
  // JWT 서명 키를 IP 해시에 직접 사용하지 않고 고정된 용도 문자열로 전용 키를 파생한다.
  // 모든 서버가 같은 JWT 키를 쓰면 같은 quota를 공유한다. JWT 키 교체 시 IP quota도 새로 시작된다.
  return createHmac("sha256", rootSecret)
    .update("dfkorea:quote-ip:v1")
    .digest();
}

export function quoteAllowedOrigins(
  config: QuoteConfiguration,
): string | undefined {
  const explicit = config.get<string>("QUOTE_ALLOWED_ORIGINS")?.trim();
  if (explicit) return explicit;
  const cors = config.get<string>("CORS_ORIGIN")?.trim();
  if (cors) return cors;
  const site = config.get<string>("PUBLIC_SITE_URL")?.trim();
  if (!site) return undefined;
  try {
    const url = new URL(site);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Invalid public site URL");
    return url.origin;
  } catch {
    quoteError(
      503,
      "QUOTE_CONFIGURATION",
      "홈페이지 주소 설정을 확인해 주세요.",
    );
  }
}

export function quoteWorkerEnabled(config: QuoteConfiguration): boolean {
  const override = config.get<string>("QUOTE_WORKER_ENABLED")?.trim();
  // 개발/테스트에서 실메일을 자동 발송하지 않으며, 운영에서는 별도 활성화 변수 없이 실행한다.
  return override
    ? override === "true"
    : config.get<string>("NODE_ENV") === "production";
}

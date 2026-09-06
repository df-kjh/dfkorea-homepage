import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource, EntityManager } from "typeorm";
import { createHmac, randomBytes } from "crypto";
import {
  assertOrigin,
  businessHash,
  privacyConfiguration,
  quoteError,
  tokenHash,
} from "./quote-policy";
import { VerificationDto } from "./quote.dto";
import { quoteAllowedOrigins, quoteIpHashKey } from "./quote-configuration";
import { NtsVerifier } from "./nts-verifier";

@Injectable()
export class QuoteSessionService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly nts: NtsVerifier,
  ) {}
  privacy() {
    return privacyConfiguration(this.config);
  }
  async checkIp(ip: string) {
    const hash = createHmac("sha256", quoteIpHashKey(this.config))
      .update(ip || "unknown")
      .digest("hex");
    const rows = await this.db.query(
      `INSERT INTO quote_ip_quotas(ip_hash,window_start) VALUES($1,date_trunc('hour',now())) ON CONFLICT(ip_hash,window_start) DO UPDATE SET requests=quote_ip_quotas.requests+1 RETURNING requests`,
      [hash],
    );
    if (rows[0].requests > 120)
      quoteError(
        429,
        "IP_RATE_LIMIT",
        "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      );
  }
  async create() {
    const privacy = this.privacy();
    const sessionToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.db.query(
      "INSERT INTO quote_sessions(token_hash,expires_at) VALUES($1,$2)",
      [tokenHash(sessionToken), expiresAt],
    );
    return { sessionToken, expiresAt, privacy };
  }
  async authenticate(authorization: string | undefined) {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization || "")?.[1];
    if (!token)
      quoteError(401, "SESSION_REQUIRED", "작성 세션을 다시 시작해 주세요.");
    const [session] = await this.db.query(
      "SELECT id,expires_at FROM quote_sessions WHERE token_hash=$1",
      [tokenHash(token)],
    );
    if (!session || new Date(session.expires_at) <= new Date())
      quoteError(
        401,
        "SESSION_EXPIRED",
        "작성 세션이 만료되었습니다. 다시 시작해 주세요.",
      );
    return session.id as string;
  }
  async lock(manager: EntityManager, sessionId: string) {
    const [session] = await manager.query(
      "SELECT * FROM quote_sessions WHERE id=$1 FOR UPDATE",
      [sessionId],
    );
    if (!session || new Date(session.expires_at) <= new Date())
      quoteError(
        401,
        "SESSION_EXPIRED",
        "작성 세션이 만료되었습니다. 다시 시작해 주세요.",
      );
    return session;
  }
  assertConsent(version: string) {
    if (version !== this.privacy().version)
      quoteError(
        422,
        "CONSENT_REQUIRED",
        "현재 수집·이용 안내에 동의해 주세요.",
      );
  }
  async verify(sessionId: string, input: VerificationDto) {
    this.assertConsent(input.consentVersion);
    if (input.openingDate > new Date().toISOString().slice(0, 10))
      quoteError(400, "INVALID_OPENING_DATE", "개업일자를 확인해 주세요.");
    await this.db.transaction(async (manager) => {
      const session = await this.lock(manager, sessionId);
      if (session.verification_count >= 10)
        quoteError(
          429,
          "VERIFICATION_RATE_LIMIT",
          "사업자 확인 횟수를 초과했습니다. 전화 또는 이메일로 문의해 주세요.",
        );
      await manager.query(
        "UPDATE quote_sessions SET verification_count=verification_count+1 WHERE id=$1",
        [sessionId],
      );
    });
    await this.nts.verify(input);
    const verificationToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.db.transaction(async (manager) => {
      await this.lock(manager, sessionId);
      await manager.query(
        "INSERT INTO quote_business_verifications(session_id,token_hash,input_hash,consent_version,verified_at,expires_at) VALUES($1,$2,$3,$4,now(),$5)",
        [
          sessionId,
          tokenHash(verificationToken),
          businessHash(input),
          input.consentVersion,
          expiresAt,
        ],
      );
    });
    return { verificationToken, expiresAt };
  }
}

@Injectable()
export class QuoteOriginGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly sessions: QuoteSessionService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    assertOrigin(request.headers.origin, quoteAllowedOrigins(this.config));
    // Express의 신뢰 프록시 설정을 우회하는 X-Forwarded-For를 직접 읽지 않는다.
    await this.sessions.checkIp(request.ip || request.socket?.remoteAddress);
    return true;
  }
}
@Injectable()
export class QuoteSessionGuard implements CanActivate {
  constructor(private readonly sessions: QuoteSessionService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.quoteSessionId = await this.sessions.authenticate(
      request.headers.authorization,
    );
    return true;
  }
}

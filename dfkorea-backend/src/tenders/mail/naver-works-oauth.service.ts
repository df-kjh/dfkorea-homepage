import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { MoreThan, Repository } from "typeorm";
import { TenderMailOAuthCredential } from "../entities/tender-mail-oauth-credential.entity";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "./mail-delivery-outcome";
import { NaverWorksTokenCipher } from "./naver-works-token-cipher";

const CREDENTIAL_KEY = "naver-works";
const AUTHORIZATION_ENDPOINT =
  "https://auth.worksmobile.com/oauth2/v2.0/authorize";
const TOKEN_ENDPOINT = "https://auth.worksmobile.com/oauth2/v2.0/token";
const STATE_TTL_MS = 10 * 60 * 1000;
const EXPIRY_SKEW_MS = 60 * 1000;

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: string | number;
  scope?: string;
  token_type: string;
}

@Injectable()
export class NaverWorksOAuthService {
  private refreshPromise: Promise<string> | null = null;

  constructor(
    @InjectRepository(TenderMailOAuthCredential)
    private readonly repository: Repository<TenderMailOAuthCredential>,
    private readonly config: ConfigService,
    private readonly cipher: NaverWorksTokenCipher,
  ) {}

  async beginAuthorization(now = new Date()): Promise<string> {
    const configuration = this.getConfiguration();
    const state = randomBytes(32).toString("hex");
    const credential = await this.getOrCreate();
    await this.repository.save({
      ...credential,
      oauthStateHash: this.hashState(state),
      oauthStateExpiresAt: new Date(now.getTime() + STATE_TTL_MS),
    });
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.searchParams.set("client_id", configuration.clientId);
    url.searchParams.set("redirect_uri", configuration.redirectUri);
    url.searchParams.set("scope", "mail");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async completeAuthorization(
    code: string,
    state: string,
    now = new Date(),
  ): Promise<void> {
    const configuration = this.getConfiguration();
    const credential = await this.repository.findOne({
      where: { singletonKey: CREDENTIAL_KEY },
    });
    if (!this.isValidState(credential, state, now)) {
      throw new Error("NAVER WORKS authorization state is invalid or expired");
    }
    const claimed = await this.repository.update(
      {
        id: credential!.id,
        oauthStateHash: credential!.oauthStateHash!,
        oauthStateExpiresAt: MoreThan(now),
      },
      { oauthStateHash: null, oauthStateExpiresAt: null },
    );
    if (claimed.affected !== 1) {
      throw new Error("NAVER WORKS authorization state is invalid or expired");
    }
    const tokens = await this.requestTokens(
      new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        redirect_uri: configuration.redirectUri,
      }),
    );
    if (!tokens.refresh_token) {
      throw new Error("NAVER WORKS authorization did not return a refresh token");
    }
    await this.repository.save({
      ...credential,
      accessTokenEncrypted: this.cipher.encrypt(tokens.access_token),
      refreshTokenEncrypted: this.cipher.encrypt(tokens.refresh_token),
      accessTokenExpiresAt: this.toExpiresAt(now, tokens.expires_in),
      scope: tokens.scope ?? "mail",
      oauthStateHash: null,
      oauthStateExpiresAt: null,
      connectedAt: now,
    });
  }

  async getAccessToken(
    forceRefresh = false,
    now = new Date(),
    rejectedAccessToken?: string,
  ): Promise<string> {
    try {
      if (!forceRefresh || rejectedAccessToken) {
        const credential = await this.repository.findOne({
          where: { singletonKey: CREDENTIAL_KEY },
        });
        if (
          credential?.accessTokenEncrypted &&
          credential.accessTokenExpiresAt &&
          credential.accessTokenExpiresAt > now
        ) {
          const cachedAccessToken = this.decryptCredential(
            credential.accessTokenEncrypted,
          );
          if (!forceRefresh || cachedAccessToken !== rejectedAccessToken) {
            return cachedAccessToken;
          }
        }
      }
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshAccessToken(
          now,
          rejectedAccessToken,
        ).finally(() => {
          this.refreshPromise = null;
        });
      }
      return await this.refreshPromise;
    } catch (error) {
      if (error instanceof MailDeliveryError) {
        throw error;
      }
      // Repository failures happen before the provider accepts a message and
      // are therefore safe to retry; they must never become DELIVERY_UNCERTAIN.
      throw new MailDeliveryError(MailDeliveryOutcome.RETRYABLE_REJECTION);
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
    connectedAt: Date | null;
    accessTokenExpiresAt: Date | null;
  }> {
    const credential = await this.repository.findOne({
      where: { singletonKey: CREDENTIAL_KEY },
    });
    return {
      connected: Boolean(credential?.refreshTokenEncrypted),
      connectedAt: credential?.connectedAt ?? null,
      accessTokenExpiresAt: credential?.accessTokenExpiresAt ?? null,
    };
  }

  private async refreshAccessToken(
    now: Date,
    rejectedAccessToken?: string,
  ): Promise<string> {
    const configuration = this.getConfiguration();
    return this.repository.manager.transaction(async (manager) => {
      const lockedRepository = manager.getRepository(TenderMailOAuthCredential);
      const credential = await lockedRepository.findOne({
        where: { singletonKey: CREDENTIAL_KEY },
        lock: { mode: "pessimistic_write" },
      });
      if (!credential?.refreshTokenEncrypted) {
        throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
      }
      if (
        rejectedAccessToken &&
        credential.accessTokenEncrypted &&
        credential.accessTokenExpiresAt &&
        credential.accessTokenExpiresAt > now
      ) {
        const currentToken = this.decryptCredential(
          credential.accessTokenEncrypted,
        );
        if (currentToken !== rejectedAccessToken) {
          return currentToken;
        }
      }
      const refreshToken = this.decryptCredential(
        credential.refreshTokenEncrypted,
      );
      const tokens = await this.requestTokens(
        new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          client_id: configuration.clientId,
          client_secret: configuration.clientSecret,
        }),
      );
      await lockedRepository.save({
        ...credential,
        accessTokenEncrypted: this.cipher.encrypt(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? this.cipher.encrypt(tokens.refresh_token)
          : credential.refreshTokenEncrypted,
        accessTokenExpiresAt: this.toExpiresAt(now, tokens.expires_in),
        scope: tokens.scope ?? credential.scope,
      });
      return tokens.access_token;
    });
  }

  private decryptCredential(value: string): string {
    try {
      return this.cipher.decrypt(value);
    } catch {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
  }

  private async requestTokens(body: URLSearchParams): Promise<OAuthTokenResponse> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.getHttpTimeoutMs(),
    );
    try {
      response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });
    } catch {
      throw new MailDeliveryError(MailDeliveryOutcome.RETRYABLE_REJECTION);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new MailDeliveryError(
        response.status === 429 || response.status >= 500
          ? MailDeliveryOutcome.RETRYABLE_REJECTION
          : MailDeliveryOutcome.PERMANENT_REJECTION,
      );
    }
    let candidate: Partial<OAuthTokenResponse>;
    try {
      candidate = (await response.json()) as Partial<OAuthTokenResponse>;
    } catch {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    const expiresIn = Number(candidate.expires_in);
    if (
      !candidate.access_token ||
      candidate.token_type !== "Bearer" ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    return candidate as OAuthTokenResponse;
  }

  private async getOrCreate(): Promise<TenderMailOAuthCredential> {
    return (
      (await this.repository.findOne({
        where: { singletonKey: CREDENTIAL_KEY },
      })) ??
      this.repository.create({
        singletonKey: CREDENTIAL_KEY,
        provider: "NAVER_WORKS",
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        accessTokenExpiresAt: null,
        scope: null,
        oauthStateHash: null,
        oauthStateExpiresAt: null,
        connectedAt: null,
      })
    );
  }

  private isValidState(
    credential: TenderMailOAuthCredential | null,
    state: string,
    now: Date,
  ): boolean {
    if (
      !credential?.oauthStateHash ||
      !credential.oauthStateExpiresAt ||
      credential.oauthStateExpiresAt <= now
    ) {
      return false;
    }
    const expected = Buffer.from(credential.oauthStateHash, "hex");
    const actual = Buffer.from(this.hashState(state), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hashState(state: string): string {
    return createHash("sha256").update(state).digest("hex");
  }

  private toExpiresAt(now: Date, expiresIn: string | number): Date {
    const durationMs = Number(expiresIn) * 1000;
    return new Date(now.getTime() + Math.max(0, durationMs - EXPIRY_SKEW_MS));
  }

  private getConfiguration(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    const clientId = this.config.get<string>("NAVER_WORKS_CLIENT_ID")?.trim();
    const clientSecret = this.config
      .get<string>("NAVER_WORKS_CLIENT_SECRET")
      ?.trim();
    const redirectUri = this.config
      .get<string>("NAVER_WORKS_OAUTH_REDIRECT_URI")
      ?.trim();
    let parsedRedirect: URL;
    try {
      parsedRedirect = new URL(redirectUri ?? "");
    } catch {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    if (
      !clientId ||
      !clientSecret ||
      parsedRedirect.protocol !== "https:" ||
      /[\r\n]/.test(clientId) ||
      /[\r\n]/.test(clientSecret)
    ) {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    return { clientId, clientSecret, redirectUri: parsedRedirect.toString() };
  }

  private getHttpTimeoutMs(): number {
    const timeoutMs = Number(
      this.config.get<string>("NAVER_WORKS_HTTP_TIMEOUT_MS") ?? "10000",
    );
    if (
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 30000
    ) {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    return timeoutMs;
  }
}

import { ConfigService } from "@nestjs/config";
import type { Repository } from "typeorm";
import { TenderMailOAuthCredential } from "../entities/tender-mail-oauth-credential.entity";
import { NaverWorksOAuthService } from "./naver-works-oauth.service";
import { NaverWorksTokenCipher } from "./naver-works-token-cipher";
import {
  classifyMailDeliveryError,
  MailDeliveryOutcome,
} from "./mail-delivery-outcome";

describe("NaverWorksOAuthService", () => {
  const encryptionKey = Buffer.alloc(32, 9).toString("base64");
  const config = new ConfigService({
    NAVER_WORKS_CLIENT_ID: "client-id",
    NAVER_WORKS_CLIENT_SECRET: "client-secret",
    NAVER_WORKS_OAUTH_REDIRECT_URI:
      "https://api.example.com/tenders/mail/oauth/callback",
    NAVER_WORKS_TOKEN_ENCRYPTION_KEY: encryptionKey,
    NAVER_WORKS_HTTP_TIMEOUT_MS: "5000",
  });
  let stored: TenderMailOAuthCredential | null;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    manager: { transaction: jest.Mock; getRepository: jest.Mock };
  };
  let service: NaverWorksOAuthService;

  beforeEach(() => {
    stored = null;
    const findOne = jest.fn(async () => stored);
    const save = jest.fn(async (value) => {
      stored = { ...(stored ?? {}), ...value } as TenderMailOAuthCredential;
      return stored;
    });
    repository = {
      findOne,
      create: jest.fn((value) => ({ id: "credential-1", ...value }) as TenderMailOAuthCredential),
      save,
      update: jest.fn(async (_criteria, value) => {
        if (!stored?.oauthStateHash || !stored.oauthStateExpiresAt) {
          return { affected: 0 };
        }
        stored = { ...stored, ...value } as TenderMailOAuthCredential;
        return { affected: 1 };
      }),
      manager: {
        getRepository: jest.fn(),
        transaction: jest.fn(async (callback) => callback(repository.manager)),
      },
    };
    repository.manager.getRepository.mockReturnValue({ findOne, save });
    service = new NaverWorksOAuthService(
      repository as unknown as Repository<TenderMailOAuthCredential>,
      config,
      new NaverWorksTokenCipher(config),
    );
    jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => jest.restoreAllMocks());

  it("creates a one-time authorization state without storing its plaintext", async () => {
    const now = new Date("2026-08-31T02:00:00.000Z");

    const authorizationUrl = await service.beginAuthorization(now);
    const parsed = new URL(authorizationUrl);
    const state = parsed.searchParams.get("state");

    expect(parsed.origin + parsed.pathname).toBe(
      "https://auth.worksmobile.com/oauth2/v2.0/authorize",
    );
    expect(parsed.searchParams.get("client_id")).toBe("client-id");
    expect(parsed.searchParams.get("scope")).toBe("mail");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(state).toHaveLength(64);
    expect(stored?.oauthStateHash).not.toBe(state);
    expect(stored?.oauthStateExpiresAt).toEqual(
      new Date("2026-08-31T02:10:00.000Z"),
    );
  });

  it("exchanges the authorization code and encrypts both OAuth tokens", async () => {
    const now = new Date("2026-08-31T02:00:00.000Z");
    const authorizationUrl = await service.beginAuthorization(now);
    const state = new URL(authorizationUrl).searchParams.get("state") as string;
    const fetchMock = jest.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-secret",
          refresh_token: "refresh-secret",
          expires_in: "3600",
          scope: "mail",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await service.completeAuthorization("authorization-code", state, now);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.worksmobile.com/oauth2/v2.0/token",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(request.body)).toContain("grant_type=authorization_code");
    expect(String(request.body)).not.toContain("access-secret");
    expect(stored?.accessTokenEncrypted).not.toContain("access-secret");
    expect(stored?.refreshTokenEncrypted).not.toContain("refresh-secret");
    expect(stored?.accessTokenExpiresAt).toEqual(
      new Date("2026-08-31T02:59:00.000Z"),
    );
    expect(stored?.oauthStateHash).toBeNull();
    await expect(service.getAccessToken(false, now)).resolves.toBe(
      "access-secret",
    );
  });

  it("rejects an expired authorization state before token exchange", async () => {
    const authorizationUrl = await service.beginAuthorization(
      new Date("2026-08-31T02:00:00.000Z"),
    );
    const validState = new URL(authorizationUrl).searchParams.get("state") as string;

    await expect(
      service.completeAuthorization(
        `${validState.slice(0, -1)}x`,
        validState,
        new Date("2026-08-31T02:11:00.000Z"),
      ),
    ).rejects.toThrow("NAVER WORKS authorization state is invalid or expired");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects a mismatched authorization state before token exchange", async () => {
    const authorizationUrl = await service.beginAuthorization(
      new Date("2026-08-31T02:00:00.000Z"),
    );
    const validState = new URL(authorizationUrl).searchParams.get("state") as string;
    const mismatchedState = `${validState.slice(0, -1)}${validState.endsWith("a") ? "b" : "a"}`;

    await expect(
      service.completeAuthorization(
        "authorization-code",
        mismatchedState,
        new Date("2026-08-31T02:01:00.000Z"),
      ),
    ).rejects.toThrow("NAVER WORKS authorization state is invalid or expired");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("atomically consumes an authorization state before token exchange", async () => {
    const now = new Date("2026-08-31T02:00:00.000Z");
    const authorizationUrl = await service.beginAuthorization(now);
    const state = new URL(authorizationUrl).searchParams.get("state") as string;
    repository.update.mockResolvedValueOnce({ affected: 0 });

    await expect(
      service.completeAuthorization("authorization-code", state, now),
    ).rejects.toThrow("NAVER WORKS authorization state is invalid or expired");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("single-flights refresh and persists a rotated refresh token", async () => {
    const cipher = new NaverWorksTokenCipher(config);
    stored = {
      id: "credential-1",
      singletonKey: "naver-works",
      provider: "NAVER_WORKS",
      accessTokenEncrypted: cipher.encrypt("expired-access"),
      refreshTokenEncrypted: cipher.encrypt("old-refresh"),
      accessTokenExpiresAt: new Date("2026-08-31T01:00:00.000Z"),
      scope: "mail",
      oauthStateHash: null,
      oauthStateExpiresAt: null,
      connectedAt: new Date("2026-08-30T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fetchMock = jest.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: "3600",
          scope: "mail",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const now = new Date("2026-08-31T02:00:00.000Z");

    const tokens = await Promise.all([
      service.getAccessToken(false, now),
      service.getAccessToken(false, now),
    ]);

    expect(tokens).toEqual(["new-access", "new-access"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cipher.decrypt(stored?.refreshTokenEncrypted as string)).toBe(
      "new-refresh",
    );
  });

  it("reuses a newer cached token when another recipient already refreshed the rejected token", async () => {
    const cipher = new NaverWorksTokenCipher(config);
    stored = {
      id: "credential-1",
      singletonKey: "naver-works",
      provider: "NAVER_WORKS",
      accessTokenEncrypted: cipher.encrypt("new-access"),
      refreshTokenEncrypted: cipher.encrypt("refresh-secret"),
      accessTokenExpiresAt: new Date("2026-08-31T03:00:00.000Z"),
      scope: "mail",
      oauthStateHash: null,
      oauthStateExpiresAt: null,
      connectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(
      service.getAccessToken(
        true,
        new Date("2026-08-31T02:00:00.000Z"),
        "rejected-old-access",
      ),
    ).resolves.toBe("new-access");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("bounds token refresh requests and classifies a pre-send network failure as retryable", async () => {
    const cipher = new NaverWorksTokenCipher(config);
    stored = {
      id: "credential-1",
      singletonKey: "naver-works",
      provider: "NAVER_WORKS",
      accessTokenEncrypted: null,
      refreshTokenEncrypted: cipher.encrypt("refresh-secret"),
      accessTokenExpiresAt: null,
      scope: "mail",
      oauthStateHash: null,
      oauthStateExpiresAt: null,
      connectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let requestSignal: AbortSignal | null | undefined;
    jest.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      requestSignal = init?.signal;
      throw new TypeError("network unavailable");
    });

    const error = await service
      .getAccessToken(true, new Date("2026-08-31T02:00:00.000Z"))
      .catch((reason) => reason);

    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.RETRYABLE_REJECTION,
    );
    expect(requestSignal).toBeInstanceOf(AbortSignal);
  });

  it("classifies a corrupt encrypted token as a permanent pre-send rejection", async () => {
    stored = {
      id: "credential-1",
      singletonKey: "naver-works",
      provider: "NAVER_WORKS",
      accessTokenEncrypted: "corrupt",
      refreshTokenEncrypted: "corrupt",
      accessTokenExpiresAt: new Date("2026-08-31T03:00:00.000Z"),
      scope: "mail",
      oauthStateHash: null,
      oauthStateExpiresAt: null,
      connectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const error = await service
      .getAccessToken(false, new Date("2026-08-31T02:00:00.000Z"))
      .catch((reason) => reason);

    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.PERMANENT_REJECTION,
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

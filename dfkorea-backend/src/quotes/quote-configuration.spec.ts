import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { DataSource } from "typeorm";
import { QuoteOriginGuard, QuoteSessionService } from "./quote-session.service";
import { QuoteWorkerService } from "./quote-worker.service";
import { privacyConfiguration } from "./quote-policy";

const jwtSecret = "existing-Production-JWT-secret-123456789!";
const config = (values: Record<string, string> = {}) =>
  new ConfigService(values);
const session = (values: Record<string, string> = {}, count = 1) => {
  const query = jest.fn().mockResolvedValue([{ requests: count }]);
  const service = new QuoteSessionService(
    { query } as unknown as DataSource,
    config({ NODE_ENV: "production", JWT_SECRET: jwtSecret, ...values }),
    {} as never,
  );
  return { query, service };
};

describe("quote settings reuse existing application configuration", () => {
  it("hashes IPs consistently with a purpose-derived JWT key without another secret", async () => {
    const first = session();
    const second = session();
    await first.service.checkIp("192.0.2.1");
    await second.service.checkIp("192.0.2.1");
    const key = createHmac("sha256", jwtSecret)
      .update("dfkorea:quote-ip:v1")
      .digest();
    const expected = createHmac("sha256", key)
      .update("192.0.2.1")
      .digest("hex");
    expect(first.query.mock.calls[0][1]).toEqual([expected]);
    expect(second.query.mock.calls[0][1]).toEqual([expected]);
    await second.service.checkIp("192.0.2.2");
    expect(second.query.mock.calls[1][1]).not.toEqual([expected]);
    expect(JSON.stringify(first.query.mock.calls)).not.toContain("192.0.2.1");
  });

  it("keeps the IP limit and refuses a missing production root secret", async () => {
    await expect(
      session({}, 121).service.checkIp("192.0.2.1"),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      session({ JWT_SECRET: "" }).service.checkIp("192.0.2.1"),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("preserves an existing explicit IP key and rejects an invalid override", async () => {
    const override = "separate-existing-quote-secret-123456789";
    const { service, query } = session({ QUOTE_IP_HASH_SECRET: override });
    await service.checkIp("192.0.2.1");
    expect(query.mock.calls[0][1]).toEqual([
      createHmac("sha256", override).update("192.0.2.1").digest("hex"),
    ]);
    await expect(
      session({ QUOTE_IP_HASH_SECRET: "short" }).service.checkIp("192.0.2.1"),
    ).rejects.toMatchObject({ status: 503 });
  });

  const authorize = async (values: Record<string, string>, origin?: string) => {
    const guard = new QuoteOriginGuard(config(values), {
      checkIp: async () => undefined,
    } as never);
    return guard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { origin }, ip: "192.0.2.1" }),
      }),
    } as never);
  };

  it("uses existing exact CORS origins without a duplicate quote allowlist", async () => {
    const values = {
      CORS_ORIGIN: "https://site.example, https://www.site.example",
    };
    await expect(authorize(values, "https://www.site.example")).resolves.toBe(
      true,
    );
    for (const origin of [
      undefined,
      "https://site.example.evil.test",
      "https://evil.vercel.app",
    ]) {
      await expect(authorize(values, origin)).rejects.toMatchObject({
        status: 403,
      });
    }
  });

  it("falls back to the public site origin but never bypasses an invalid explicit allowlist", async () => {
    await expect(
      authorize(
        { PUBLIC_SITE_URL: "https://site.example/" },
        "https://site.example",
      ),
    ).resolves.toBe(true);
    await expect(
      authorize(
        { CORS_ORIGIN: "*", PUBLIC_SITE_URL: "https://site.example" },
        "https://site.example",
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(authorize({}, "https://site.example")).rejects.toMatchObject({
      status: 503,
    });
    await expect(
      authorize({ PUBLIC_SITE_URL: "not-a-url" }, "https://site.example"),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      authorize(
        {
          QUOTE_ALLOWED_ORIGINS: "https://restricted.example",
          CORS_ORIGIN: "https://site.example",
        },
        "https://site.example",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("retains the existing 365 day default without setting a retention variable", () => {
    expect(privacyConfiguration(config()).retentionDays).toBe(365);
    expect(
      privacyConfiguration(config({ QUOTE_RETENTION_DAYS: "30" }))
        .retentionDays,
    ).toBe(30);
  });
});

describe("quote worker default lifecycle", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it.each([
    [{ NODE_ENV: "production" }, true],
    [{ NODE_ENV: "production", QUOTE_WORKER_ENABLED: "false" }, false],
    [{ NODE_ENV: "development" }, false],
    [{ NODE_ENV: "test" }, false],
    [{ NODE_ENV: "development", QUOTE_WORKER_ENABLED: "true" }, true],
  ])("starts only for enabled environments (%j)", async (values, enabled) => {
    const worker = new QuoteWorkerService(
      {} as never,
      config(values),
      {} as never,
      {} as never,
    );
    const tick = jest.spyOn(worker, "tick").mockResolvedValue(undefined);
    worker.onModuleInit();
    await jest.advanceTimersByTimeAsync(15000);
    expect(tick).toHaveBeenCalledTimes(enabled ? 1 : 0);
    worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(15000);
    expect(tick).toHaveBeenCalledTimes(enabled ? 1 : 0);
  });
});

import express = require("express");
import request = require("supertest");
import { createCorsOptions, httpSecurityHeaders } from "./http-security";

function allows(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = { NODE_ENV: "production" },
): boolean {
  let allowed = false;
  const options = createCorsOptions(env);
  if (typeof options.origin !== "function")
    throw new Error("Expected origin callback");
  options.origin(origin, (_error, result) => {
    allowed = result === true;
  });
  return allowed;
}

describe("credentialed CORS boundary", () => {
  it("allows the production website and Origin-less SSR requests", () => {
    expect(allows("https://dfkorealed.com")).toBe(true);
    expect(allows(undefined)).toBe(true);
  });

  it.each([
    "https://attacker.vercel.app",
    "https://attacker.railway.app",
    "https://dfkorealed.com.attacker.example",
    "http://localhost:5173",
    "https://dfkorealed.com:444",
    "null",
    "",
    "https://dfkorealed.com/path",
    "https://user@dfkorealed.com",
  ])("rejects untrusted or malformed production origin %s", (origin) => {
    expect(allows(origin)).toBe(false);
  });

  it("allows only the explicitly named preview tenant", () => {
    const env = {
      NODE_ENV: "production",
      CORS_ORIGIN: "https://dfkorealed.com, https://trusted.vercel.app",
    };
    expect(allows("https://trusted.vercel.app", env)).toBe(true);
    expect(allows("https://other.vercel.app", env)).toBe(false);
  });

  it.each([
    "*",
    "https://*.vercel.app",
    "https://dfkorealed.com/path",
    "https://user@dfkorealed.com",
    "null",
    "https://dfkorealed.com,",
  ])("fails startup on invalid allowlist %s", (CORS_ORIGIN) => {
    expect(() =>
      createCorsOptions({ NODE_ENV: "production", CORS_ORIGIN }),
    ).toThrow();
  });

  it("does not trust Codespaces environment flags or substring matches", () => {
    const env = { NODE_ENV: "development", CODESPACES: "true" };
    expect(allows("http://localhost:5173", env)).toBe(true);
    expect(allows("https://attacker.github.dev.evil.test", env)).toBe(false);
    expect(allows("https://localhost.evil.test", env)).toBe(false);
    expect(allows("https://other.github.dev", env)).toBe(false);
  });
});

describe("HTTP response security", () => {
  const app = (production = true, trustProxy = false) => {
    const server = express();
    if (trustProxy) server.set("trust proxy", 1);
    server.use(httpSecurityHeaders(production));
    server.get("*", (_req, res) => res.send("ok"));
    return server;
  };

  it("protects public responses without disabling caching or scripts", async () => {
    const response = await request(app()).get("/products");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["content-security-policy"]).toBe(
      "frame-ancestors 'none'",
    );
    expect(response.headers["cache-control"]).toBeUndefined();
  });

  it("prevents storage of authenticated and authentication responses", async () => {
    for (const path of ["/auth/login", "/products"]) {
      const response = await request(app())
        .get(path)
        .set("Authorization", "Bearer test");
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("forces local PDFs to download", async () => {
    const response = await request(app()).get("/uploads/certification.PDF");
    expect(response.headers["content-disposition"]).toBe("attachment");
  });

  it("sets HSTS only for production HTTPS via trusted transport", async () => {
    const plain = await request(app())
      .get("/")
      .set("X-Forwarded-Proto", "https");
    const secure = await request(app(true, true))
      .get("/")
      .set("X-Forwarded-Proto", "https");
    const development = await request(app(false, true))
      .get("/")
      .set("X-Forwarded-Proto", "https");
    expect(plain.headers["strict-transport-security"]).toBeUndefined();
    expect(secure.headers["strict-transport-security"]).toBe(
      "max-age=31536000",
    );
    expect(development.headers["strict-transport-security"]).toBeUndefined();
  });
});

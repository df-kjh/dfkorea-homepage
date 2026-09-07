import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import type { RequestHandler } from "express";

function isExactHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.hostname.includes("*") &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

export function createCorsOptions(env: NodeJS.ProcessEnv): CorsOptions {
  const origins =
    env.CORS_ORIGIN !== undefined
      ? env.CORS_ORIGIN.split(",").map((value) => value.trim())
      : env.NODE_ENV === "production"
        ? ["https://dfkorealed.com"]
        : [
            "https://dfkorealed.com",
            "http://localhost:5173",
            "http://localhost:5174",
          ];
  if (origins.some((origin) => !isExactHttpOrigin(origin))) {
    throw new Error(
      "CORS_ORIGIN must contain comma-separated exact http(s) origins without paths, credentials, or wildcards",
    );
  }
  const allowed = new Set(origins);
  return {
    // Origin-less server requests remain usable. CORS is not authentication;
    // protected API routes must still validate their bearer token independently.
    origin: (origin, callback) =>
      callback(null, origin === undefined || allowed.has(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

export function httpSecurityHeaders(production: boolean): RequestHandler {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Restrict framing without changing script/style loading for Nuxt, WebGL or the editor.
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    // req.secure honors forwarded protocol only when trust proxy was explicitly configured.
    if (production && req.secure)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    if (req.headers.authorization || /^\/auth(?:\/|$)/i.test(req.path)) {
      res.setHeader("Cache-Control", "no-store");
    }
    if (/^\/uploads\/.*\.pdf$/i.test(req.path))
      res.setHeader("Content-Disposition", "attachment");
    next();
  };
}

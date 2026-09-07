import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import * as bcrypt from "bcrypt";
import { DatabaseService } from "../database/database.service";
import { resolveJwtSecret } from "../config/production-environment";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_BUCKETS = 10_000;
// Fixed valid bcrypt hash: missing accounts still pay the password comparison cost.
const DUMMY_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

@Injectable()
export class AuthService {
  private readonly credentialKey = resolveJwtSecret(process.env);
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();

  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
  ) {}

  private consumeAttempt(source: string, username: string) {
    const now = Date.now();
    for (const [key, bucket] of this.attempts) {
      if (bucket.expires <= now) this.attempts.delete(key);
    }
    const keys: [string, number][] = [
      [`ip:${createHash("sha256").update(source).digest("hex")}`, 30],
      [
        `account:${createHash("sha256").update(username.toLowerCase()).digest("hex")}`,
        10,
      ],
    ];
    // Fail closed at capacity; evicting active entries would let username spray bypass limits.
    if (
      keys.some(
        ([key, limit]) => (this.attempts.get(key)?.count ?? 0) >= limit,
      ) ||
      this.attempts.size +
        keys.filter(([key]) => !this.attempts.has(key)).length >
        MAX_BUCKETS
    ) {
      throw new HttpException(
        "Too many login attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    for (const [key] of keys) {
      const bucket = this.attempts.get(key) ?? {
        count: 0,
        expires: now + WINDOW_MS,
      };
      bucket.count += 1;
      this.attempts.set(key, bucket);
    }
  }

  private credentialVersion(passwordHash: string) {
    return createHmac("sha256", this.credentialKey)
      .update(`admin-credential:${passwordHash}`)
      .digest("hex");
  }

  async validateUser(username: string, password: string) {
    const admin = await this.databaseService.getAdmin();
    const valid = await bcrypt.compare(password, admin?.password ?? DUMMY_HASH);
    if (!admin || admin.username !== username || !valid) return null;
    return {
      username: admin.username,
      credentialVersion: this.credentialVersion(admin.password),
    };
  }

  async login(username: string, password: string, source = "unknown") {
    this.consumeAttempt(
      source,
      typeof username === "string" ? username.slice(0, 128) : "invalid",
    );
    // Preserve existing bcrypt passphrases (including its legacy 72-byte semantics),
    // while bounding untrusted input. Password policy changes belong to provisioning.
    if (
      typeof username !== "string" ||
      username.length > 128 ||
      !username.length ||
      typeof password !== "string" ||
      !password.length ||
      Buffer.byteLength(password) > 1024
    ) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const user = await this.validateUser(username, password);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    return {
      access_token: this.jwtService.sign(
        {
          username: user.username,
          sub: user.username,
          cv: user.credentialVersion,
        },
        { expiresIn: "1h" },
      ),
      user: { username: user.username },
    };
  }

  async validateSession(payload: unknown) {
    const claims = payload as Record<string, unknown> | null;
    const admin = await this.databaseService.getAdmin();
    if (
      !admin ||
      !claims ||
      claims.username !== admin.username ||
      claims.sub !== admin.username ||
      typeof claims.cv !== "string" ||
      !/^[a-f0-9]{64}$/.test(claims.cv) ||
      typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException("Invalid session");
    }
    if (
      !timingSafeEqual(
        Buffer.from(claims.cv, "hex"),
        Buffer.from(this.credentialVersion(admin.password), "hex"),
      )
    ) {
      throw new UnauthorizedException("Invalid session");
    }
    return { username: admin.username };
  }
}

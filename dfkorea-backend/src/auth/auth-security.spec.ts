import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { DatabaseService } from "../database/database.service";
import { JwtStrategy } from "./jwt.strategy";

describe("admin authentication boundaries", () => {
  const jwt = new JwtService({
    secret: "test-only-secret-more-than-thirty-two-bytes",
    signOptions: { expiresIn: "1h" },
  });
  let admin: { username: string; password: string } | null;
  let service: AuthService;
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-only-secret-more-than-thirty-two-bytes";
    admin = {
      username: "admin",
      password: await bcrypt.hash("correct-password", 4),
    };
    service = new AuthService(
      { getAdmin: async () => admin } as DatabaseService,
      jwt,
    );
  });
  it("returns generic unauthorized when the administrator is absent", async () => {
    admin = null;
    await expect(service.login("admin", "anything")).rejects.toMatchObject({
      status: 401,
    });
  });
  it("rejects old username-only tokens, changed credentials and removed administrators", async () => {
    process.env.JWT_SECRET = "test-only-secret-more-than-thirty-two-bytes";
    const strategy = new JwtStrategy(service);
    await expect(
      strategy.validate({ username: "admin", sub: "admin" }),
    ).rejects.toMatchObject({ status: 401 });
    const login = await service.login("admin", "correct-password");
    const payload = jwt.verify(login.access_token);
    await expect(strategy.validate(payload)).resolves.toEqual({
      username: "admin",
    });
    await expect(
      strategy.validate({ ...payload, sub: "someone-else" }),
    ).rejects.toMatchObject({ status: 401 });
    admin!.password = await bcrypt.hash("new-password", 4);
    await expect(strategy.validate(payload)).rejects.toMatchObject({
      status: 401,
    });
    admin = null;
    await expect(strategy.validate(payload)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("retains compatibility with previously provisioned long bcrypt passphrases while bounding input", async () => {
    const password = "a".repeat(100);
    admin!.password = await bcrypt.hash(password, 4);
    await expect(service.login("admin", password)).resolves.toHaveProperty(
      "access_token",
    );
    await expect(
      service.login("admin", "a".repeat(1025)),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("throttles a single account across source IP changes and recovers after the window", async () => {
    jest.useFakeTimers();
    try {
      for (let index = 0; index < 10; index++) {
        await expect(
          service.login("admin", "wrong", `ip-${index}`),
        ).rejects.toMatchObject({ status: 401 });
      }
      await expect(
        service.login("admin", "correct-password", "new-ip"),
      ).rejects.toMatchObject({ status: 429 });
      jest.advanceTimersByTime(15 * 60 * 1000 + 1);
      await expect(
        service.login("admin", "correct-password", "new-ip"),
      ).resolves.toHaveProperty("access_token");
    } finally {
      jest.useRealTimers();
    }
  });
  it("throttles username spray from the same source", async () => {
    for (let index = 0; index < 30; index++) {
      await expect(
        service.login(`unknown-${index}`, "wrong", "one-ip"),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(
      service.login("admin", "correct-password", "one-ip"),
    ).rejects.toMatchObject({ status: 429 });
  });
});

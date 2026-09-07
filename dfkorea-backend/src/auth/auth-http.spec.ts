import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import * as request from "supertest";
import * as bcrypt from "bcrypt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { DatabaseService } from "../database/database.service";

describe("admin HTTP authentication", () => {
  let app: INestApplication;
  let jwt: JwtService;
  const secret = "test-only-secret-more-than-thirty-two-bytes";
  beforeEach(async () => {
    process.env.JWT_SECRET = secret;
    const admin = {
      username: "admin",
      password: await bcrypt.hash("correct-password", 4),
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret })],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: DatabaseService, useValue: { getAdmin: async () => admin } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    jwt = app.get(JwtService);
  });
  afterEach(() => app.close());
  it("requires a valid live admin token on the session route", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "correct-password" })
      .expect(200);
    const claims = jwt.verify(login.body.access_token);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(3600);
    await request(app.getHttpServer()).get("/auth/session").expect(401);
    await request(app.getHttpServer())
      .get("/auth/session")
      .set("Authorization", `Bearer ${login.body.access_token}`)
      .expect(200, { user: { username: "admin" } });
    const { exp: _exp, iat: _iat, ...identity } = claims;
    for (const token of [
      jwt.sign(identity, {
        secret: "incorrect-signing-secret",
        expiresIn: "1h",
      }),
      jwt.sign(identity, { expiresIn: -1 }),
      jwt.sign(identity),
      jwt.sign({ username: "admin", sub: "admin" }, { expiresIn: "1h" }),
    ]) {
      await request(app.getHttpServer())
        .get("/auth/session")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    }
  });
  it("cannot bypass source throttling by rotating X-Forwarded-For and usernames", async () => {
    for (let index = 0; index < 30; index++) {
      await request(app.getHttpServer())
        .post("/auth/login")
        .set("X-Forwarded-For", `198.51.100.${index}`)
        .send({ username: `spray-${index}`, password: "wrong" })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Forwarded-For", "203.0.113.1")
      .send({ username: "admin", password: "correct-password" })
      .expect(429);
  });
});

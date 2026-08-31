import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import { NaverWorksOAuthService } from "../src/tenders/mail/naver-works-oauth.service";
import { TenderMailOAuthController } from "../src/tenders/tender-mail-oauth.controller";

describe("Tender mail OAuth HTTP contract", () => {
  let app: INestApplication;
  const oauth = {
    beginAuthorization: jest
      .fn()
      .mockResolvedValue("https://auth.worksmobile.com/oauth2/v2.0/authorize"),
    completeAuthorization: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({
      connected: false,
      connectedAt: null,
      accessTokenExpiresAt: null,
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenderMailOAuthController],
      providers: [
        { provide: NaverWorksOAuthService, useValue: oauth },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("https://www.dfkorealed.com") },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const authorization = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string | undefined> }>()
            .headers.authorization;
          if (authorization !== "Bearer admin-token") {
            throw new UnauthorizedException();
          }
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it("protects authorization initiation", async () => {
    await request(app.getHttpServer())
      .post("/tenders/mail/oauth/authorize")
      .expect(401);
    await request(app.getHttpServer())
      .post("/tenders/mail/oauth/authorize")
      .set("Authorization", "Bearer admin-token")
      .expect(201)
      .expect({
        authorizationUrl:
          "https://auth.worksmobile.com/oauth2/v2.0/authorize",
      });
  });

  it("keeps the state-validated provider callback public", async () => {
    await request(app.getHttpServer())
      .get("/tenders/mail/oauth/callback")
      .query({ code: "code-value", state: "state-value" })
      .expect(302)
      .expect(
        "Location",
        "https://www.dfkorealed.com/admin/dashboard?tab=tenders&mailOAuth=connected",
      );
    expect(oauth.completeAuthorization).toHaveBeenCalledWith(
      "code-value",
      "state-value",
    );
  });
});

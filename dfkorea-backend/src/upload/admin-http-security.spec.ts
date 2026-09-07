import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import passport = require("passport");
import request = require("supertest");
import { UploadController } from "./upload.controller";
import { ProductsController } from "../products/products.controller";
import { PostsController } from "../posts/posts.controller";
import { CertificatesController } from "../certificates/certificates.controller";
import { SchedulerController } from "../scheduler/scheduler.controller";
import { TendersController } from "../tenders/tenders.controller";
import { TenderMailOAuthController } from "../tenders/tender-mail-oauth.controller";
import { QuoteAdminController } from "../quotes/quote-admin.controller";

// Keep real routes, Multer, and JwtAuthGuard; replace external DB/AI/storage services.
const controllers = [
  UploadController,
  ProductsController,
  PostsController,
  CertificatesController,
  SchedulerController,
  TendersController,
  TenderMailOAuthController,
  QuoteAdminController,
];
const privateRoutes: [string, string][] = [
  ["post", "/upload/image"],
  ["post", "/upload/file"],
  ["delete", "/upload/image"],
  ...["products", "posts", "certificates"].flatMap(
    (route): [string, string][] => [
      ["post", `/${route}`],
      ["put", `/${route}/test-id`],
      ["delete", `/${route}/test-id`],
    ],
  ),
  ["post", "/products/generate-description"],
  ["post", "/scheduler/trigger"],
  ["post", "/scheduler/trigger/product-company-news"],
  ["get", "/quotes/admin"],
  ["get", "/quotes/admin/test-id"],
  ["get", "/quotes/admin/test-id/attachments/test-id"],
  ["post", "/quotes/admin/test-id/retry"],
  ["get", "/tenders"],
  ["get", "/tenders/calendar"],
  ["get", "/tenders/subscription"],
  ["put", "/tenders/subscription"],
  ["get", "/tenders/company-profile"],
  ["put", "/tenders/company-profile"],
  ["post", "/tenders/collect"],
  ["post", "/tenders/award-results/backfill"],
  ["get", "/tenders/award-results/status"],
  ["get", "/tenders/test-id/analysis"],
  ["post", "/tenders/test-id/analysis"],
  ["post", "/tenders/test-id/review"],
  ["get", "/tenders/test-id"],
  ["post", "/tenders/mail/oauth/authorize"],
  ["get", "/tenders/mail/oauth/status"],
];
describe("admin route authorization HTTP contract", () => {
  let app: INestApplication;
  const reached: string[] = [];
  beforeAll(async () => {
    // A local verifier is enough to exercise missing/invalid JWT rejection. Actual
    // persisted admin/credential validation is covered by the auth security suite.
    passport.use(
      "jwt",
      new Strategy(
        {
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          secretOrKey: "local-test-only",
        },
        (_payload, done) => done(null, { username: "test-admin" }),
      ),
    );
    const dependencies = [
      ...new Set(
        controllers.flatMap((controller) =>
          Reflect.getMetadata("design:paramtypes", controller),
        ),
      ),
    ];
    const providers = dependencies.map((dependency) => ({
      provide: dependency,
      useValue: Object.fromEntries(
        Object.getOwnPropertyNames(dependency.prototype)
          .filter((name) => name !== "constructor")
          .map((name) => [
            name,
            () => {
              reached.push(`${dependency.name}.${name}`);
              return dependency.name === "UploadService" &&
                name === "uploadImage"
                ? "https://assets.example.test/temp/image-1-2.webp"
                : [];
            },
          ]),
      ),
    }));
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers,
      providers,
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    reached.length = 0;
  });
  afterAll(async () => {
    await app.close();
    passport.unuse("jwt");
  });
  it.each(privateRoutes)(
    "rejects anonymous %s %s before reaching services",
    async (method, path) => {
      await request(app.getHttpServer())[method](path).send({}).expect(401);
      expect(reached).toEqual([]);
    },
  );
  it.each(["image", "file"])(
    "rejects anonymous malformed multipart %s before Multer parsing",
    async (route) => {
      await request(app.getHttpServer())
        .post(`/upload/${route}`)
        .set("Content-Type", "multipart/form-data; boundary=missing")
        .send("not-a-valid-multipart-body")
        .expect(401);
      expect(reached).toEqual([]);
    },
  );
  it("accepts an authenticated multipart upload", async () => {
    const token = new JwtService({ secret: "local-test-only" }).sign({
      sub: "test-admin",
    });
    const response = await request(app.getHttpServer())
      .post("/upload/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("fixture"), "photo.png")
      .expect(201);
    expect(response.body.url).toBe(
      "https://assets.example.test/temp/image-1-2.webp",
    );
    expect(reached).toEqual(["UploadService.uploadImage"]);
  });
  it.each(["image", "file"])(
    "rejects unexpected multipart fields on authenticated %s uploads",
    async (route) => {
      const token = new JwtService({ secret: "local-test-only" }).sign({
        sub: "test-admin",
      });
      await request(app.getHttpServer())
        .post(`/upload/${route}`)
        .set("Authorization", `Bearer ${token}`)
        .field("unexpected", "large-field-placeholder")
        .attach(route, Buffer.from("fixture"), "photo.png")
        .expect(400);
      expect(reached).toEqual([]);
    },
  );
  it("rejects forged bearer upload requests", async () => {
    await request(app.getHttpServer())
      .delete("/upload/image")
      .set("Authorization", "Bearer forged-token")
      .send({ url: "https://assets.example.test/products/image-1-2.webp" })
      .expect(401);
    expect(reached).toEqual([]);
  });
  it.each([
    "/products",
    "/products/filter-options",
    "/products/featured/list",
    "/products/test-id",
    "/posts",
    "/posts/test-id",
    "/certificates",
    "/certificates/test-id",
  ])("preserves anonymous public reads %s", async (path) => {
    await request(app.getHttpServer()).get(path).expect(200);
    expect(reached).toHaveLength(1);
  });
  it("preserves the public view counter", async () => {
    await request(app.getHttpServer()).post("/posts/test-id/view").expect(201);
    expect(reached).toEqual(["PostsService.incrementViews"]);
  });
});

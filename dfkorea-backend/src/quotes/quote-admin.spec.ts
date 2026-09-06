import { AddQuoteAttachmentPayloads1788652900000 } from "../migrations/1788652900000-AddQuoteAttachmentPayloads";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import request = require("supertest");
import { JwtStrategy } from "../auth/jwt.strategy";
import { CreateQuoteTables1788652800000 } from "../migrations/1788652800000-CreateQuoteTables";
import { QuotePrivateStorage } from "./quote-attachment.service";
import { QuoteAdminController } from "./quote-admin.controller";
import { QuoteAdminService } from "./quote-admin.service";

const signingSecret = "quote-admin-tests-only-0123456789abcdef";
const jwt = new JwtService({ secret: signingSecret });
const token = () => jwt.sign({ username: "admin-test", sub: "admin-test" });
const actor = { userId: "admin-42", username: "admin-test" };
const retryBody = {
  acknowledgeDuplicateRisk: true,
  reason: "담당자가 전송 상태를 확인하고 재발송 요청",
};
async function createApp(db: unknown, storage: unknown) {
  const module = await Test.createTestingModule({
    controllers: [QuoteAdminController],
    providers: [
      QuoteAdminService,
      { provide: DataSource, useValue: db },
      { provide: QuotePrivateStorage, useValue: storage },
      {
        provide: JwtStrategy,
        useFactory: () => {
          const previous = process.env.JWT_SECRET;
          process.env.JWT_SECRET = signingSecret;
          try {
            return new JwtStrategy();
          } finally {
            if (previous === undefined) delete process.env.JWT_SECRET;
            else process.env.JWT_SECRET = previous;
          }
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  return app;
}

describe("Quote admin authentication and input boundary", () => {
  let app: INestApplication;
  const db = { query: jest.fn(), transaction: jest.fn() };
  beforeAll(async () => {
    app = await createApp(db, {});
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());
  it.each([
    "",
    `/${randomUUID()}`,
    `/${randomUUID()}/attachments/${randomUUID()}`,
  ])("rejects unauthenticated GET %s", async (path) => {
    await request(app.getHttpServer()).get(`/quotes/admin${path}`).expect(401);
    expect(db.query).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated retries before touching the database", async () => {
    await request(app.getHttpServer())
      .post(`/quotes/admin/${randomUUID()}/retry`)
      .send(retryBody)
      .expect(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it.each([
    "tampered.token.value",
    jwt.sign({ username: "admin" }, { expiresIn: -1 }),
  ])("rejects invalid or expired JWTs", async (authorization) => {
    await request(app.getHttpServer())
      .get("/quotes/admin")
      .auth(authorization, { type: "bearer" })
      .expect(401);
  });
  it.each([
    { page: "0" },
    { page: "1x" },
    { limit: "101" },
    { limit: "0" },
    { status: "FAILED' OR 1=1--" },
    { page: ["1", "2"] },
  ])("rejects malformed list filters %j", async (query) => {
    await request(app.getHttpServer())
      .get("/quotes/admin")
      .auth(token(), { type: "bearer" })
      .query(query)
      .expect(400);
    expect(db.query).not.toHaveBeenCalled();
  });
  it.each([
    { reason: "valid reason" },
    { ...retryBody, acknowledgeDuplicateRisk: false },
    { ...retryBody, reason: "four" },
    { ...retryBody, reason: "a".repeat(501) },
    { ...retryBody, reason: " ".repeat(20) },
    { ...retryBody, unexpected: true },
  ])(
    "requires explicit duplicate risk acknowledgement and a bounded audit reason %j",
    async (body) => {
      await request(app.getHttpServer())
        .post(`/quotes/admin/${randomUUID()}/retry`)
        .auth(token(), { type: "bearer" })
        .send(body)
        .expect(400);
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );
  it("rejects malformed receipt and attachment identifiers", async () => {
    await request(app.getHttpServer())
      .get("/quotes/admin/not-an-id")
      .auth(token(), { type: "bearer" })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/quotes/admin/${randomUUID()}/attachments/not-an-id`)
      .auth(token(), { type: "bearer" })
      .expect(400);
    expect(db.query).not.toHaveBeenCalled();
  });
});

const testDatabaseUrl = process.env.QUOTE_ADMIN_TEST_DATABASE_URL;
const integration = testDatabaseUrl ? describe : describe.skip;
integration("Quote admin isolated PostgreSQL operations", () => {
  let db: DataSource;
  let app: INestApplication;
  let service: QuoteAdminService;
  const storage = {
    read: jest.fn(),
    assertAvailable: (ids: string[], manager: any) =>
      new QuotePrivateStorage(db).assertAvailable(ids, manager),
  };
  const schema = `quote_admin_${randomUUID().replace(/-/g, "")}`;
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl);
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "55439" ||
      url.pathname !== "/dfkorea_quote_admin_test"
    )
      throw new Error(
        "Quote admin tests require the explicitly isolated local admin test database",
      );
    db = new DataSource({
      type: "postgres",
      url: testDatabaseUrl,
      extra: { options: `-c search_path=${schema},public` },
    });
    await db.initialize();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public',
    );
    await db.query("CREATE TABLE products (id uuid PRIMARY KEY)");
    const runner = db.createQueryRunner();
    try {
      await new CreateQuoteTables1788652800000().up(runner);
      await new AddQuoteAttachmentPayloads1788652900000().up(runner);
    } finally {
      await runner.release();
    }
    service = new QuoteAdminService(
      db,
      storage as unknown as QuotePrivateStorage,
    );
    app = await createApp(db, storage);
  });
  beforeEach(async () => {
    await db.query("TRUNCATE quote_sessions,quote_requests CASCADE");
    storage.read
      .mockReset()
      .mockResolvedValue(Buffer.from("private image bytes"));
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });
  const receipt = async (status = "FAILED") => {
    const sessionId = randomUUID(),
      id = randomUUID(),
      itemId = randomUUID(),
      attachmentId = randomUUID();
    await db.query(
      "INSERT INTO quote_sessions(id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [sessionId, randomUUID()],
    );
    await db.query(
      "INSERT INTO quote_requests(id,session_id,reference,idempotency_key,payload_hash,company,verified_at,consent_version,consented_at,expires_at) VALUES($1,$2,$3,$4,'secret-payload-hash',$5,now(),'v1',now(),now()+interval '1 year')",
      [
        id,
        sessionId,
        `Q-${id}`,
        randomUUID(),
        JSON.stringify({
          companyName: "테스트 조명",
          contactName: "김 담당",
          email: "contact@example.com",
        }),
      ],
    );
    await db.query(
      "INSERT INTO quote_items(id,request_id,client_id,kind,snapshot,selected,quantity) VALUES($1,$2,'client1','custom',$3,'{}',4)",
      [itemId, id, JSON.stringify({ name: "직접 입력 제품" })],
    );
    await db.query(
      "INSERT INTO quote_attachments(client_attachment_id,source_hash,source_size,id,session_id,request_id,item_id,storage_key,name,mime_type,size,sha256,state,expires_at) VALUES($1,'fixture',19,$1,$2,$3,$4,$5,'현장 사진.jpg','image/jpeg',19,'secret-file-hash','READY',now()+interval '1 year')",
      [attachmentId, sessionId, id, itemId, `quote/${attachmentId}.jpg`],
    );
    await db.query(
      "INSERT INTO quote_attachment_payloads(attachment_id,bytes,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [attachmentId, Buffer.from("private image bytes")],
    );
    await db.query(
      "INSERT INTO quote_mail_deliveries(request_id,status,attempts,claimed_at,claim_token,error_code,history) VALUES($1,$2,3,now(),$3,'PREVIOUS_PROVIDER_ERROR',$4)",
      [
        id,
        status,
        randomUUID(),
        JSON.stringify([{ event: "PREVIOUS_ATTEMPT" }]),
      ],
    );
    return { id, itemId, attachmentId };
  };
  it("returns bounded results, global status counts and oldest pending time", async () => {
    await receipt("FAILED");
    await receipt("PENDING");
    await receipt("DELIVERY_UNCERTAIN");
    await db.query(
      "UPDATE quote_mail_deliveries SET created_at='2026-01-01T00:00:00Z' WHERE status='PENDING'",
    );
    const response = await request(app.getHttpServer())
      .get("/quotes/admin?page=1&limit=1&status=FAILED")
      .auth(token(), { type: "bearer" })
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      status: "FAILED",
      companyName: "테스트 조명",
    });
    expect(response.body.counts).toEqual({
      PENDING: 1,
      SENDING: 0,
      PROVIDER_ACCEPTED: 0,
      FAILED: 1,
      DELIVERY_UNCERTAIN: 1,
    });
    expect(response.body.oldestPendingAt).toBe("2026-01-01T00:00:00.000Z");
  });
  it("returns structured receipt detail without session secrets or storage keys", async () => {
    const row = await receipt();
    const response = await request(app.getHttpServer())
      .get(`/quotes/admin/${row.id}`)
      .auth(token(), { type: "bearer" })
      .expect(200);
    expect(response.body.request).toMatchObject({
      id: row.id,
      company: { companyName: "테스트 조명" },
    });
    expect(response.body.items[0]).toMatchObject({
      id: row.itemId,
      quantity: 4,
      snapshot: { name: "직접 입력 제품" },
    });
    expect(response.body.attachments[0]).toMatchObject({
      id: row.attachmentId,
      itemId: row.itemId,
      mimeType: "image/jpeg",
    });
    expect(response.body.delivery).toMatchObject({
      status: "FAILED",
      errorCode: "PREVIOUS_PROVIDER_ERROR",
    });
    const serialized = JSON.stringify(response.body);
    for (const secret of [
      "secret-payload-hash",
      "secret-file-hash",
      "storage_key",
      "session_id",
      "claim_token",
      "token_hash",
    ])
      expect(serialized).not.toContain(secret);
  });
  it("requires attachment ownership and emits private safe download headers", async () => {
    const a = await receipt(),
      b = await receipt();
    await request(app.getHttpServer())
      .get(`/quotes/admin/${a.id}/attachments/${b.attachmentId}`)
      .auth(token(), { type: "bearer" })
      .expect(404);
    expect(storage.read).not.toHaveBeenCalled();
    const response = await request(app.getHttpServer())
      .get(`/quotes/admin/${a.id}/attachments/${a.attachmentId}`)
      .auth(token(), { type: "bearer" })
      .expect(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["content-type"]).toBe("image/jpeg");
    expect(response.headers["content-disposition"]).toContain(
      "filename*=UTF-8''",
    );
    expect(response.body).toEqual(Buffer.from("private image bytes"));
  });
  it.each(["FAILED", "DELIVERY_UNCERTAIN"])(
    "queues %s once with audited actor, reason and previous status while retaining diagnostics",
    async (status) => {
      const row = await receipt(status);
      await expect(
        service.retry(row.id, retryBody, actor),
      ).resolves.toMatchObject({ status: "PENDING" });
      const [delivery] = await db.query(
        "SELECT * FROM quote_mail_deliveries WHERE request_id=$1",
        [row.id],
      );
      expect(delivery).toMatchObject({
        status: "PENDING",
        attempts: 0,
        claimed_at: null,
        claim_token: null,
        error_code: "PREVIOUS_PROVIDER_ERROR",
      });
      expect(delivery.next_attempt_at.getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
      expect(delivery.history).toHaveLength(2);
      expect(delivery.history[1]).toMatchObject({
        event: "MANUAL_RETRY",
        previousStatus: status,
        actor,
        reason: retryBody.reason,
        at: expect.any(String),
      });
    },
  );
  it.each(["PENDING", "SENDING", "PROVIDER_ACCEPTED"])(
    "does not resend %s deliveries",
    async (status) => {
      const row = await receipt(status);
      await expect(
        service.retry(row.id, retryBody, actor),
      ).rejects.toMatchObject({ status: 409 });
      const [delivery] = await db.query(
        "SELECT status,history FROM quote_mail_deliveries WHERE request_id=$1",
        [row.id],
      );
      expect(delivery).toEqual({
        status,
        history: [{ event: "PREVIOUS_ATTEMPT" }],
      });
    },
  );
  it("serializes concurrent admin retries so exactly one retry is recorded", async () => {
    const row = await receipt();
    const blocker = db.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    await blocker.query(
      "SELECT id FROM quote_mail_deliveries WHERE request_id=$1 FOR UPDATE",
      [row.id],
    );
    const attempts = Promise.allSettled([
      service.retry(row.id, retryBody, actor),
      service.retry(row.id, retryBody, actor),
    ]);
    try {
      let waiting = 0;
      for (let attempt = 0; attempt < 40; attempt++) {
        const [locks] = await db.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT d.id,d.status,r.expires_at%'",
        );
        waiting = locks.count;
        if (waiting === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(waiting).toBe(2);
    } finally {
      await blocker.commitTransaction();
      await blocker.release();
    }
    const results = await attempts;
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const [delivery] = await db.query(
      "SELECT status,history FROM quote_mail_deliveries WHERE request_id=$1",
      [row.id],
    );
    expect(delivery.status).toBe("PENDING");
    expect(delivery.history).toHaveLength(2);
  });
  it("records the current username-only JWT identity in the audit entry", async () => {
    const row = await receipt();
    await request(app.getHttpServer())
      .post(`/quotes/admin/${row.id}/retry`)
      .auth(token(), { type: "bearer" })
      .send(retryBody)
      .expect(200);
    const [delivery] = await db.query(
      "SELECT history FROM quote_mail_deliveries WHERE request_id=$1",
      [row.id],
    );
    expect(delivery.history[1].actor).toEqual({ username: "admin-test" });
  });
  it("returns 404 for missing receipts and refuses expired receipt retries", async () => {
    await request(app.getHttpServer())
      .get(`/quotes/admin/${randomUUID()}`)
      .auth(token(), { type: "bearer" })
      .expect(404);
    const row = await receipt();
    await db.query(
      "UPDATE quote_requests SET expires_at=now()-interval '1 day' WHERE id=$1",
      [row.id],
    );
    await expect(service.retry(row.id, retryBody, actor)).rejects.toMatchObject(
      { status: 410 },
    );
  });
});

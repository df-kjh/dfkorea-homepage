import { AddQuoteAttachmentPayloads1788652900000 } from "../migrations/1788652900000-AddQuoteAttachmentPayloads";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import sharp = require("sharp");
import { CreateQuoteTables1788652800000 } from "../migrations/1788652800000-CreateQuoteTables";
import { Product } from "../entities/product.entity";
import { QUOTE_ENTITIES } from "./entities/quote.entity";
import { QuoteSessionService } from "./quote-session.service";
import {
  QuotePrivateStorage,
  QuoteAttachmentService,
} from "./quote-attachment.service";
import { QuoteSubmissionService } from "./quote-submission.service";
import { QuoteWorkerService } from "./quote-worker.service";
import { QuoteAdminService } from "./quote-admin.service";
import { NtsVerifier } from "./nts-verifier";
import { businessHash, tokenHash } from "./quote-policy";
import { NaverWorksMailTransport } from "../tenders/mail/naver-works-mail.transport";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "../tenders/mail/mail-delivery-outcome";
const url = process.env.QUOTE_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55439" ||
    parsed.pathname !== "/dfkorea_quote_test"
  )
    throw new Error("Refusing non-disposable quote database");
}
const describeDatabase = url ? describe : describe.skip;
describeDatabase("temporary PostgreSQL email attachments", () => {
  let db: DataSource,
    storage: QuotePrivateStorage,
    sessions: QuoteSessionService,
    uploads: QuoteAttachmentService,
    submissions: QuoteSubmissionService,
    worker: QuoteWorkerService,
    admin: QuoteAdminService;
  const config = new ConfigService({
    NODE_ENV: "production",
    QUOTE_RETENTION_DAYS: "365",
  });
  const company = {
    companyName: "테스트상호",
    businessNumber: "1234567890",
    representativeName: "대표",
    openingDate: "2020-01-01",
    contactName: "담당",
    email: "contact@example.com",
  };
  const send = jest.spyOn(NaverWorksMailTransport.prototype, "sendMail");
  beforeAll(async () => {
    db = new DataSource({
      type: "postgres",
      url,
      entities: [Product, ...QUOTE_ENTITIES],
      migrations: [
        CreateQuoteTables1788652800000,
        AddQuoteAttachmentPayloads1788652900000,
      ],
      synchronize: false,
      logging: false,
    });
    await db.initialize();
    await db.query("DROP SCHEMA public CASCADE");
    await db.query("CREATE SCHEMA public");
    const core = new DataSource({
      type: "postgres",
      url,
      entities: [Product],
      synchronize: false,
      logging: false,
    });
    await core.initialize();
    await core.synchronize();
    await core.destroy();
    await db.runMigrations();
    storage = new QuotePrivateStorage(db);
    sessions = new QuoteSessionService(db, config, new NtsVerifier(config));
    uploads = new QuoteAttachmentService(db, sessions, storage);
    submissions = new QuoteSubmissionService(db, sessions);
    worker = new QuoteWorkerService(db, config, {} as any, storage);
    admin = new QuoteAdminService(db, storage);
  }, 30000);
  afterAll(async () => {
    send.mockRestore();
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(async () => {
    await db.query(
      "TRUNCATE quote_mail_deliveries,quote_attachments,quote_items,quote_requests,quote_business_verifications,quote_sessions,quote_ip_quotas CASCADE",
    );
    send.mockReset().mockResolvedValue({ providerMessageId: null });
  });
  async function draft(photoCount = 1) {
    const session = await sessions.create();
    const sessionId = await sessions.authenticate(
      `Bearer ${session.sessionToken}`,
    );
    const verificationToken = "b".repeat(64);
    await db.query(
      "INSERT INTO quote_business_verifications(session_id,token_hash,input_hash,consent_version,verified_at,expires_at) VALUES($1,$2,$3,$4,now(),now()+interval '30 minutes')",
      [
        sessionId,
        tokenHash(verificationToken),
        businessHash(company),
        session.privacy.version,
      ],
    );
    const file = {
      buffer: await sharp({
        create: { width: 10, height: 10, channels: 3, background: "red" },
      })
        .jpeg()
        .toBuffer(),
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
    };
    const clientKeys = Array.from({ length: photoCount }, () => randomUUID());
    const photos = [];
    for (const key of clientKeys)
      photos.push(await uploads.upload(sessionId, file, key));
    const input = {
      idempotencyKey: randomUUID(),
      verificationToken,
      company,
      consentVersion: session.privacy.version,
      items: [
        {
          clientId: "custom",
          kind: "custom" as const,
          name: "조명",
          description: "사진과 같은 조명",
          quantity: 1,
          certifications: [],
          options: [],
          attachmentIds: photos.map((photo) => photo.id),
        },
      ],
    };
    return { sessionId, file, photos, clientKeys, input };
  }
  async function submit(photoCount = 1) {
    const result = await draft(photoCount);
    const receipt = await submissions.submit(result.sessionId, result.input);
    const [request] = await db.query(
      "SELECT * FROM quote_requests WHERE reference=$1",
      [receipt.reference],
    );
    return { ...result, request, receipt };
  }
  const payloads = () =>
    db.query(
      "SELECT attachment_id,expires_at,octet_length(bytes) size FROM quote_attachment_payloads",
    );
  it("uploads in production without storage configuration and replays the same private bytes", async () => {
    const value = await draft();
    expect(
      await uploads.upload(value.sessionId, value.file, value.clientKeys[0]),
    ).toEqual(value.photos[0]);
    const [photo] = await db.query("SELECT * FROM quote_attachments");
    const bytes = await storage.read(photo.storage_key);
    expect(bytes.length).toBe(photo.size);
    expect(await payloads()).toHaveLength(1);
    expect((await payloads())[0].expires_at.getTime()).toBeLessThanOrEqual(
      Date.now() + 24 * 60 * 60 * 1000,
    );
    const foreign = await sessions.create();
    const foreignId = await sessions.authenticate(
      `Bearer ${foreign.sessionToken}`,
    );
    await expect(uploads.remove(foreignId, photo.id)).rejects.toMatchObject({
      status: 422,
    });
  });
  it("sends all three actual attachments and atomically purges bytes upon 202 acceptance while retaining metadata", async () => {
    const value = await submit(3);
    await worker.processOne();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].attachments).toHaveLength(3);
    expect(
      send.mock.calls[0][0].attachments.every(
        (photo) => Buffer.from(photo.data, "base64").length > 0,
      ),
    ).toBe(true);
    expect(
      (await db.query("SELECT status FROM quote_mail_deliveries"))[0].status,
    ).toBe("PROVIDER_ACCEPTED");
    expect(await payloads()).toHaveLength(0);
    expect(await db.query("SELECT id FROM quote_attachments")).toHaveLength(3);
    await expect(
      admin.attachment(value.request.id, value.photos[0].id),
    ).rejects.toMatchObject({ status: 410 });
    expect(await submissions.submit(value.sessionId, value.input)).toEqual(
      value.receipt,
    );
  });
  it.each([
    MailDeliveryOutcome.RETRYABLE_REJECTION,
    MailDeliveryOutcome.UNKNOWN_ACCEPTANCE,
  ])(
    "keeps bytes after %s without extending the seven-day expiry",
    async (outcome) => {
      await submit();
      const [initial] = await payloads();
      expect(initial.expires_at.getTime()).toBeLessThanOrEqual(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      );
      expect(initial.expires_at.getTime()).toBeGreaterThan(
        Date.now() + 6 * 24 * 60 * 60 * 1000,
      );
      send.mockRejectedValue(new MailDeliveryError(outcome));
      await worker.processOne();
      expect(await payloads()).toHaveLength(1);
      expect((await payloads())[0].expires_at).toEqual(initial.expires_at);
    },
  );
  it("does not strip missing or expired payloads from mail and rejects admin download/retry with 410", async () => {
    const value = await submit();
    await db.query(
      "UPDATE quote_attachment_payloads SET expires_at=now()-interval '1 second'",
    );
    await worker.cleanup();
    expect(await payloads()).toHaveLength(0);
    expect(await db.query("SELECT id FROM quote_attachments")).toHaveLength(1);
    await worker.processOne();
    expect(send).not.toHaveBeenCalled();
    expect(
      (
        await db.query("SELECT status,error_code FROM quote_mail_deliveries")
      )[0],
    ).toEqual({
      status: "FAILED",
      error_code: "ATTACHMENT_PAYLOAD_UNAVAILABLE",
    });
    await expect(
      admin.attachment(value.request.id, value.photos[0].id),
    ).rejects.toMatchObject({ status: 410 });
    await expect(
      admin.retry(
        value.request.id,
        {
          acknowledgeDuplicateRisk: true,
          reason: "담당자가 재전송을 요청합니다",
        },
        { username: "admin" },
      ),
    ).rejects.toMatchObject({ status: 410 });
  });
  it("preserves bytes and marks acceptance uncertain if acceptance/purge transaction fails", async () => {
    await submit();
    await db.query(
      "CREATE FUNCTION quote_test_reject_purge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced purge failure'; END $$",
    );
    await db.query(
      "CREATE TRIGGER quote_test_reject_purge BEFORE DELETE ON quote_attachment_payloads FOR EACH ROW EXECUTE FUNCTION quote_test_reject_purge()",
    );
    try {
      await worker.processOne();
      expect(send).toHaveBeenCalledTimes(1);
      expect(await payloads()).toHaveLength(1);
      expect(
        (
          await db.query(
            "SELECT status,provider_accepted_at FROM quote_mail_deliveries",
          )
        )[0],
      ).toEqual({ status: "DELIVERY_UNCERTAIN", provider_accepted_at: null });
    } finally {
      await db.query(
        "DROP TRIGGER quote_test_reject_purge ON quote_attachment_payloads",
      );
      await db.query("DROP FUNCTION quote_test_reject_purge()");
    }
  });
  it("cleanup leaves SENDING bytes alone and removes them after the delivery is no longer in-flight", async () => {
    await submit();
    await db.query(
      "UPDATE quote_attachment_payloads SET expires_at=now()-interval '1 second'",
    );
    await db.query(
      "UPDATE quote_mail_deliveries SET status='SENDING',claimed_at=now(),claim_token=$1",
      [randomUUID()],
    );
    await worker.cleanup();
    expect(await payloads()).toHaveLength(1);
    await db.query(
      "UPDATE quote_mail_deliveries SET status='DELIVERY_UNCERTAIN'",
    );
    await worker.cleanup();
    expect(await payloads()).toHaveLength(0);
  });
  it("caps photo retention at a shorter request policy and does not extend it on request replay", async () => {
    config.set("QUOTE_RETENTION_DAYS", "1");
    try {
      const value = await submit();
      const [payload] = await payloads();
      expect(payload.expires_at.getTime()).toBe(
        value.request.expires_at.getTime(),
      );
      await submissions.submit(value.sessionId, value.input);
      expect((await payloads())[0].expires_at).toEqual(payload.expires_at);
    } finally {
      config.set("QUOTE_RETENTION_DAYS", "365");
    }
  });
  it("refuses legacy READY metadata without bytes for upload replay and new submission", async () => {
    const value = await draft();
    await db.query("DELETE FROM quote_attachment_payloads");
    await expect(
      uploads.upload(value.sessionId, value.file, value.clientKeys[0]),
    ).rejects.toMatchObject({ status: 410 });
    await expect(
      submissions.submit(value.sessionId, value.input),
    ).rejects.toMatchObject({ status: 410 });
    expect(await db.query("SELECT id FROM quote_requests")).toHaveLength(0);
  });
  it("never lets stale acceptance delete bytes belonging to a newer claim", async () => {
    await submit();
    const newerClaim = randomUUID();
    send.mockImplementation(async () => {
      await db.query(
        "UPDATE quote_mail_deliveries SET claim_token=$1,status='SENDING'",
        [newerClaim],
      );
      return { providerMessageId: null };
    });
    await worker.processOne();
    expect(await payloads()).toHaveLength(1);
    expect(
      (
        await db.query(
          "SELECT status,claim_token,provider_accepted_at FROM quote_mail_deliveries",
        )
      )[0],
    ).toEqual({
      status: "SENDING",
      claim_token: newerClaim,
      provider_accepted_at: null,
    });
  });
  it("never exposes payload bytes in admin list or detail", async () => {
    const value = await submit();
    const list = await admin.list({});
    const detail = await admin.detail(value.request.id);
    expect(JSON.stringify(list)).not.toContain("bytes");
    expect(JSON.stringify(detail)).not.toContain("bytes");
    expect(detail.attachments[0]).toMatchObject({ available: true });
    await worker.processOne();
    expect((await admin.detail(value.request.id)).attachments[0]).toMatchObject(
      { available: false, payloadExpiresAt: null },
    );
  });
  it("adds/removes only the new payload table and leaves legacy metadata intact", async () => {
    await submit();
    const count = (await db.query("SELECT id FROM quote_attachments")).length;
    await db.undoLastMigration();
    expect(
      (
        await db.query("SELECT to_regclass('quote_attachment_payloads') value")
      )[0].value,
    ).toBeNull();
    expect(await db.query("SELECT id FROM quote_attachments")).toHaveLength(
      count,
    );
    await db.runMigrations();
    expect(await payloads()).toHaveLength(0);
    expect(await db.query("SELECT id FROM quote_attachments")).toHaveLength(
      count,
    );
  });
});

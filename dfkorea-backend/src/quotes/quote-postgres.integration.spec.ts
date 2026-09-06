import { AddQuoteAttachmentPayloads1788652900000 } from "../migrations/1788652900000-AddQuoteAttachmentPayloads";
import sharp = require("sharp");
import { CreateQuoteTables1788652800000 } from "../migrations/1788652800000-CreateQuoteTables";
import { NaverWorksMailTransport } from "../tenders/mail/naver-works-mail.transport";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "../tenders/mail/mail-delivery-outcome";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { QuoteSessionService } from "./quote-session.service";
import { QuoteSubmissionService } from "./quote-submission.service";
import { NtsVerifier } from "./nts-verifier";
import { QUOTE_ENTITIES } from "./entities/quote.entity";
import { Product } from "../entities/product.entity";
import { QuoteSubmissionDto } from "./quote.dto";
import {
  QuoteAttachmentService,
  QuotePrivateStorage,
} from "./quote-attachment.service";
import { QuoteWorkerService } from "./quote-worker.service";
import { businessHash, tokenHash } from "./quote-policy";

const url = process.env.QUOTE_TEST_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;
// 운영 데이터 손상을 방지하기 위해 오직 명시한 loopback disposable DB만 허용한다.
if (url) {
  const parsed = new URL(url);
  if (
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.pathname !== "/dfkorea_quote_test" ||
    parsed.port !== "55439"
  )
    throw new Error("Refusing non-disposable quote database");
}
describeDatabase(
  "quote PostgreSQL transactions (isolated database only)",
  () => {
    let db: DataSource,
      sessions: QuoteSessionService,
      submissions: QuoteSubmissionService,
      attachments: QuoteAttachmentService;
    const config = new ConfigService({
      NODE_ENV: "test",
      QUOTE_IP_HASH_SECRET: "test-only-secret-32-characters-minimum",
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
      // 기존 프로젝트의 과거 ALTER USING subquery migration 오류와 분리하여 현재 제품 스키마에서 신규 migration을 검증한다.
      await db.query("DROP SCHEMA public CASCADE");
      await db.query("CREATE SCHEMA public");
      const productsOnly = new DataSource({
        type: "postgres",
        url,
        entities: [Product],
        synchronize: false,
        logging: false,
      });
      await productsOnly.initialize();
      await productsOnly.synchronize();
      await productsOnly.destroy();
      await db.runMigrations();
      sessions = new QuoteSessionService(db, config, new NtsVerifier(config));
      submissions = new QuoteSubmissionService(db, sessions);
      attachments = new QuoteAttachmentService(
        db,
        sessions,
        new QuotePrivateStorage(db),
      );
    }, 30000);
    afterAll(async () => {
      if (db?.isInitialized) await db.destroy();
    });
    beforeEach(async () => {
      await db.query(
        "TRUNCATE quote_mail_deliveries,quote_attachments,quote_items,quote_requests,quote_business_verifications,quote_sessions,quote_ip_quotas CASCADE",
      );
    });
    async function draft() {
      const session = await sessions.create();
      const sessionId = await sessions.authenticate(
        `Bearer ${session.sessionToken}`,
      );
      const verificationToken = "a".repeat(64);
      await db.query(
        "INSERT INTO quote_business_verifications(session_id,token_hash,input_hash,consent_version,verified_at,expires_at) VALUES($1,$2,$3,$4,now(),now()+interval '30 minutes')",
        [
          sessionId,
          tokenHash(verificationToken),
          businessHash(company),
          session.privacy.version,
        ],
      );
      const input: QuoteSubmissionDto = {
        idempotencyKey: randomUUID(),
        verificationToken,
        company,
        consentVersion: session.privacy.version,
        items: [
          {
            clientId: "custom-one",
            kind: "custom",
            name: "요청 조명",
            description: "방수 40W 조명",
            quantity: 10,
            options: [],
            certifications: [],
            attachmentIds: [],
          },
        ],
      };
      return { sessionId, input, session };
    }
    it("serializes simultaneous retries into one request, item and outbox then recovers after verification expiry", async () => {
      const { sessionId, input } = await draft();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => submissions.submit(sessionId, input)),
      );
      expect(new Set(results.map((result) => result.reference)).size).toBe(1);
      const [counts] = await db.query(
        "SELECT (SELECT count(*)::int FROM quote_requests) requests,(SELECT count(*)::int FROM quote_items) items,(SELECT count(*)::int FROM quote_mail_deliveries) deliveries",
      );
      expect(counts).toEqual({ requests: 1, items: 1, deliveries: 1 });
      await db.query(
        "UPDATE quote_business_verifications SET expires_at=now()-interval '1 second'",
      );
      await expect(submissions.submit(sessionId, input)).resolves.toEqual(
        results[0],
      );
      await expect(
        submissions.submit(sessionId, { ...input, notes: "changed" }),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("does not persist anything on wrong company, foreign token or expired session", async () => {
      const { sessionId, input, session } = await draft();
      await expect(
        submissions.submit(sessionId, {
          ...input,
          company: { ...company, companyName: "틀린 상호" },
        }),
      ).rejects.toMatchObject({ status: 422 });
      const foreign = await sessions.create();
      const foreignId = await sessions.authenticate(
        `Bearer ${foreign.sessionToken}`,
      );
      await expect(submissions.submit(foreignId, input)).rejects.toMatchObject({
        status: 422,
      });
      await db.query(
        "UPDATE quote_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
        [sessionId],
      );
      await expect(
        sessions.authenticate(`Bearer ${session.sessionToken}`),
      ).rejects.toMatchObject({ status: 401 });
      expect(
        (await db.query("SELECT count(*)::int count FROM quote_requests"))[0]
          .count,
      ).toBe(0);
    });
    it("denies foreign attachment references and deletion, retaining owner file", async () => {
      const { sessionId, input } = await draft();
      const other = await sessions.create();
      const otherId = await sessions.authenticate(
        `Bearer ${other.sessionToken}`,
      );
      const id = randomUUID();
      await db.query(
        "INSERT INTO quote_attachments(client_attachment_id,source_hash,source_size,id,session_id,storage_key,name,mime_type,size,sha256,state,expires_at) VALUES($1,'fixture',10,$1,$2,$3,'photo.jpg','image/jpeg',10,'hash','READY',now()+interval '24 hours')",
        [id, otherId, `quote/${id}.jpg`],
      );
      input.items[0].attachmentIds = [id];
      await expect(submissions.submit(sessionId, input)).rejects.toMatchObject({
        status: 422,
      });
      await expect(attachments.remove(sessionId, id)).rejects.toMatchObject({
        status: 422,
      });
      expect(
        (
          await db.query("SELECT state FROM quote_attachments WHERE id=$1", [
            id,
          ])
        )[0].state,
      ).toBe("READY");
      expect(
        (await db.query("SELECT count(*)::int count FROM quote_requests"))[0]
          .count,
      ).toBe(0);
    });
    it("rolls back the request/items/photo linking if outbox insertion fails", async () => {
      const { sessionId, input } = await draft();
      await db.query(
        "CREATE FUNCTION quote_test_reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test forced failure'; END $$",
      );
      await db.query(
        "CREATE TRIGGER quote_test_reject_outbox BEFORE INSERT ON quote_mail_deliveries FOR EACH ROW EXECUTE FUNCTION quote_test_reject_outbox()",
      );
      try {
        await expect(submissions.submit(sessionId, input)).rejects.toThrow(
          "test forced failure",
        );
        expect(
          (await db.query("SELECT count(*)::int count FROM quote_requests"))[0]
            .count,
        ).toBe(0);
        expect(
          (await db.query("SELECT count(*)::int count FROM quote_items"))[0]
            .count,
        ).toBe(0);
      } finally {
        await db.query(
          "DROP TRIGGER quote_test_reject_outbox ON quote_mail_deliveries",
        );
        await db.query("DROP FUNCTION quote_test_reject_outbox()");
      }
    });
    it("marks interrupted workers uncertain without sending and removes expired private photos before rows", async () => {
      const { sessionId, input } = await draft();
      await submissions.submit(sessionId, input);
      await db.query(
        "UPDATE quote_mail_deliveries SET status='SENDING',claimed_at=now()-interval '6 minutes',claim_token=$1",
        [randomUUID()],
      );
      const storage = new QuotePrivateStorage(db);
      const worker = new QuoteWorkerService(
        db,
        config,
        {} as any,
        storage as any,
      );
      await worker.recover();
      expect(
        (await db.query("SELECT status FROM quote_mail_deliveries"))[0].status,
      ).toBe("DELIVERY_UNCERTAIN");
      expect(await worker.processOne()).toBe(false);
      const id = randomUUID();
      await db.query(
        "INSERT INTO quote_attachments(client_attachment_id,source_hash,source_size,id,session_id,storage_key,name,mime_type,size,sha256,state,expires_at) VALUES($1,'fixture',10,$1,$2,$3,'photo.jpg','image/jpeg',10,'hash','READY',now()-interval '1 second')",
        [id, sessionId, `quote/${id}.jpg`],
      );
      await worker.cleanup();

      expect(
        (await db.query("SELECT count(*)::int count FROM quote_attachments"))[0]
          .count,
      ).toBe(0);
    });
    it.each([
      { outcome: null, status: "PROVIDER_ACCEPTED" },
      { outcome: MailDeliveryOutcome.RETRYABLE_REJECTION, status: "PENDING" },
      { outcome: MailDeliveryOutcome.PERMANENT_REJECTION, status: "FAILED" },
      {
        outcome: MailDeliveryOutcome.UNKNOWN_ACCEPTANCE,
        status: "DELIVERY_UNCERTAIN",
      },
    ])(
      "records provider result $status without external requests",
      async ({ outcome, status }) => {
        const { sessionId, input } = await draft();
        await submissions.submit(sessionId, input);
        const send = jest
          .spyOn(NaverWorksMailTransport.prototype, "sendMail")
          .mockImplementation(async () => {
            if (outcome) throw new MailDeliveryError(outcome);
            return { providerMessageId: null };
          });
        try {
          const worker = new QuoteWorkerService(
            db,
            config,
            {} as any,
            {} as any,
          );
          const outcomes = await Promise.all([
            worker.processOne(),
            worker.processOne(),
          ]);
          expect(outcomes.filter(Boolean)).toHaveLength(1);
          expect(send).toHaveBeenCalledTimes(1);
          const [delivery] = await db.query(
            "SELECT * FROM quote_mail_deliveries",
          );
          expect(delivery.status).toBe(status);
          expect(delivery.attempts).toBe(1);
          if (status === "PENDING")
            expect(
              new Date(delivery.next_attempt_at).getTime(),
            ).toBeGreaterThan(Date.now() + 55000);
        } finally {
          send.mockRestore();
        }
      },
    );
    it("purges expired request metadata and attached payloads together", async () => {
      const { sessionId, input } = await draft();
      await submissions.submit(sessionId, input);
      await db.query(
        "UPDATE quote_requests SET expires_at=now()-interval '1 day'",
      );
      const worker = new QuoteWorkerService(
        db,
        config,
        {} as any,
        new QuotePrivateStorage(db),
      );
      await worker.cleanup();
      expect(await db.query("SELECT id FROM quote_requests")).toHaveLength(0);
      expect(
        await db.query("SELECT id FROM quote_mail_deliveries"),
      ).toHaveLength(0);
    });
    it("replays a lost upload response without consuming the slots for two remaining photos", async () => {
      const { sessionId } = await draft();
      const storage = new QuotePrivateStorage(db);
      jest.spyOn(storage, "put");
      const upload = new QuoteAttachmentService(db, sessions, storage as any);
      const file = {
        buffer: await sharp({
          create: { width: 10, height: 10, channels: 3, background: "red" },
        })
          .jpeg()
          .toBuffer(),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      };
      const key = randomUUID();
      const first = await upload.upload(sessionId, file, key);
      const replay = await upload.upload(sessionId, file, key);
      expect(replay).toEqual(first);
      await upload.upload(sessionId, file, randomUUID());
      await upload.upload(sessionId, file, randomUUID());
      expect(storage.put).toHaveBeenCalledTimes(3);
      expect(
        (
          await db.query(
            "SELECT upload_count FROM quote_sessions WHERE id=$1",
            [sessionId],
          )
        )[0].upload_count,
      ).toBe(3);
      expect(
        (await db.query("SELECT count(*)::int count FROM quote_attachments"))[0]
          .count,
      ).toBe(3);
    });
    it("rejects concurrent in-flight/content-changing uploads without duplicating storage or quota, then replays READY", async () => {
      const { sessionId } = await draft();
      let release: () => void, started: () => void;
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const storage = new QuotePrivateStorage(db);
      const originalPut = storage.put.bind(storage);
      jest.spyOn(storage, "put").mockImplementation(async (key, bytes) => {
        started();
        await pending;
        await originalPut(key, bytes);
      });
      const upload = new QuoteAttachmentService(db, sessions, storage as any);
      const file = {
        buffer: await sharp({
          create: { width: 10, height: 10, channels: 3, background: "red" },
        })
          .jpeg()
          .toBuffer(),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      };
      const key = randomUUID();
      const first = upload.upload(sessionId, file, key);
      await entered;
      await expect(upload.upload(sessionId, file, key)).rejects.toMatchObject({
        status: 409,
      });
      release();
      const result = await first;
      expect(await upload.upload(sessionId, file, key)).toEqual(result);
      await expect(
        upload.upload(
          sessionId,
          { ...file, buffer: Buffer.from("different") },
          key,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(storage.put).toHaveBeenCalledTimes(1);
      expect(
        (
          await db.query(
            "SELECT upload_count FROM quote_sessions WHERE id=$1",
            [sessionId],
          )
        )[0].upload_count,
      ).toBe(1);
    });
    it("recovers a transient storage failure with the same upload key and denies mutation after submission", async () => {
      const { sessionId, input } = await draft();
      const storage = new QuotePrivateStorage(db);
      jest.spyOn(storage, "put").mockRejectedValueOnce(new Error("offline"));
      const upload = new QuoteAttachmentService(db, sessions, storage as any);
      const file = {
        buffer: await sharp({
          create: { width: 10, height: 10, channels: 3, background: "red" },
        })
          .jpeg()
          .toBuffer(),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      };
      const key = randomUUID();
      await expect(upload.upload(sessionId, file, key)).rejects.toMatchObject({
        status: 503,
      });
      const photo = await upload.upload(sessionId, file, key);
      expect(
        (
          await db.query(
            "SELECT upload_count FROM quote_sessions WHERE id=$1",
            [sessionId],
          )
        )[0].upload_count,
      ).toBe(1);
      input.items[0].attachmentIds = [photo.id];
      await submissions.submit(sessionId, input);
      await expect(upload.upload(sessionId, file, key)).rejects.toMatchObject({
        status: 409,
      });
      await expect(upload.remove(sessionId, photo.id)).rejects.toMatchObject({
        status: 422,
      });
    });

    it("recovers an interrupted upload claim without allocating a second object or upload quota", async () => {
      const { sessionId } = await draft();
      const storage = new QuotePrivateStorage(db);
      jest.spyOn(storage, "put");
      const upload = new QuoteAttachmentService(db, sessions, storage as any);
      const file = {
        buffer: await sharp({
          create: { width: 10, height: 10, channels: 3, background: "red" },
        })
          .jpeg()
          .toBuffer(),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      };
      const key = randomUUID();
      const first = await upload.upload(sessionId, file, key);
      await db.query(
        "UPDATE quote_attachments SET state='UPLOADING',upload_claimed_at=now()-interval '6 minutes',upload_claim_token=$2 WHERE id=$1",
        [first.id, randomUUID()],
      );
      expect(await upload.upload(sessionId, file, key)).toEqual(first);
      await db.query(
        "UPDATE quote_business_verifications SET expires_at=now()-interval '1 minute'",
      );
      expect(await upload.upload(sessionId, file, key)).toEqual(first);
      expect(storage.put).toHaveBeenCalledTimes(2);
      expect(
        (await db.query("SELECT count(*)::int count FROM quote_attachments"))[0]
          .count,
      ).toBe(1);
      expect(
        (
          await db.query(
            "SELECT upload_count FROM quote_sessions WHERE id=$1",
            [sessionId],
          )
        )[0].upload_count,
      ).toBe(1);
    });

    it("replays deletion after a lost response and after cleanup without touching another session or submitted photo", async () => {
      const { sessionId } = await draft();
      const storage = new QuotePrivateStorage(db);
      const upload = new QuoteAttachmentService(db, sessions, storage as any);
      const file = {
        buffer: await sharp({
          create: { width: 10, height: 10, channels: 3, background: "red" },
        })
          .jpeg()
          .toBuffer(),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      };
      const photo = await upload.upload(sessionId, file, randomUUID());
      expect(await upload.remove(sessionId, photo.id)).toEqual({
        success: true,
      });
      expect(await upload.remove(sessionId, photo.id)).toEqual({
        success: true,
      });
      const foreign = await sessions.create();
      const foreignId = await sessions.authenticate(
        `Bearer ${foreign.sessionToken}`,
      );
      await expect(upload.remove(foreignId, photo.id)).rejects.toMatchObject({
        status: 422,
      });
      const worker = new QuoteWorkerService(
        db,
        config,
        {} as any,
        storage as any,
      );
      await worker.cleanup();
      expect(await upload.remove(sessionId, photo.id)).toEqual({
        success: true,
      });
    });
    it("applies down/up cleanly with real foreign key/check/unique constraints", async () => {
      await db.undoLastMigration();
      expect(
        (
          await db.query(
            "SELECT to_regclass('public.quote_attachment_payloads') present",
          )
        )[0].present,
      ).toBeNull();
      await db.runMigrations();
      const [constraints] = await db.query(
        "SELECT count(*)::int count FROM pg_constraint WHERE conrelid='quote_attachments'::regclass",
      );
      expect(constraints.count).toBeGreaterThanOrEqual(6);
    });
  },
);

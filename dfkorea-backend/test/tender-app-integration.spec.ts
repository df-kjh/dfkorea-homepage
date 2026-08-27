import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import * as request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import {
  G2B_TENDER_ADAPTER,
  KAPT_TENDER_ADAPTER,
  KEPCO_TENDER_ADAPTER,
} from "../src/tenders/adapters/public-api-client";
import { NormalizedTender } from "../src/tenders/domain/normalized-tender";
import { TenderSourceAdapter } from "../src/tenders/domain/tender-source.adapter";
import {
  MailDeliveryStatus,
  ProcurementType,
  TenderRelevance,
  TenderSource,
} from "../src/tenders/domain/tender.enums";
import { Tender } from "../src/tenders/entities/tender.entity";
import { TenderMailDelivery } from "../src/tenders/entities/tender-mail-delivery.entity";
import { Admin } from "../src/entities/admin.entity";
import { TenderIngestionService } from "../src/tenders/services/tender-ingestion.service";
import {
  TENDER_MAIL_TRANSPORT,
  TenderMailService,
} from "../src/tenders/services/tender-mail.service";
import migrationDataSource from "../src/database/typeorm.config";
import {
  clearTenderIntegrationTables,
  closeTenderIntegrationResources,
} from "./tender-test-cleanup";

const NOTICE: NormalizedTender = {
  source: TenderSource.G2B,
  sourceNoticeId: "TEST-G2B-1",
  revision: "000",
  title: "LED 가로등 교체공사",
  orderingOrganization: "통합 테스트 기관",
  demandOrganization: null,
  registeredAt: new Date("2026-08-27T03:00:00.000Z"),
  bidStartedAt: null,
  bidEndedAt: null,
  openedAt: null,
  region: "서울",
  procurementType: ProcurementType.CONSTRUCTION,
  contractMethod: null,
  estimatedAmount: "1000000",
  sourceUrl: "https://example.invalid/tender/test-g2b-1",
  itemName: "LED 등기구",
  description: "통합 테스트 fixture",
  attachmentNames: [],
  rawData: { fixture: true },
};

describe("Tender AppModule PostgreSQL integration", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  const g2b = {
    source: TenderSource.G2B,
    fetchNotices: jest.fn(),
  } as jest.Mocked<TenderSourceAdapter>;
  const kapt = {
    source: TenderSource.KAPT,
    fetchNotices: jest.fn(),
  } as jest.Mocked<TenderSourceAdapter>;
  const kepco = {
    source: TenderSource.KEPCO,
    fetchNotices: jest.fn(),
  } as jest.Mocked<TenderSourceAdapter>;
  const transport = { sendMail: jest.fn() };

  beforeAll(async () => {
    // This DataSource receives only TEST_DB_* / TEST_DATABASE_URL aliases from
    // setup-test-env. The dedicated command refuses absent or unsafe targets.
    await migrationDataSource.initialize();
    try {
      await migrationDataSource.runMigrations();
    } finally {
      if (migrationDataSource.isInitialized) await migrationDataSource.destroy();
    }

    // The transport itself is overridden below, but the real mail service
    // validates this config before calling that boundary.
    process.env.SMTP_HOST = "smtp.worksmobile.com";
    process.env.SMTP_USER = "tender-test@example.com";
    process.env.SMTP_APP_PASSWORD = "test-only-password";

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(G2B_TENDER_ADAPTER)
      .useValue(g2b)
      .overrideProvider(KAPT_TENDER_ADAPTER)
      .useValue(kapt)
      .overrideProvider(KEPCO_TENDER_ADAPTER)
      .useValue(kepco)
      .overrideProvider(TENDER_MAIL_TRANSPORT)
      .useValue(transport)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);

    await clearTenderIntegrationTables(dataSource);
    await dataSource.getRepository(Admin).upsert(
      {
        username: "admin",
        password: await bcrypt.hash("integration-admin-password", 10),
      },
      ["username"],
    );
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "integration-admin-password" })
      .expect(200);
    adminToken = login.body.access_token;
  });

  beforeEach(async () => {
    g2b.fetchNotices.mockReset();
    kapt.fetchNotices.mockReset();
    kepco.fetchNotices.mockReset();
    await clearTenderIntegrationTables(dataSource);
  });

  afterAll(async () => {
    await closeTenderIntegrationResources(dataSource, async () => {
      if (app) await app.close();
    });
  });

  it("uses real TypeORM storage for mocked-adapter ingestion and authenticated queries", async () => {
    g2b.fetchNotices.mockResolvedValue([NOTICE]);
    kapt.fetchNotices.mockResolvedValue([]);
    kepco.fetchNotices.mockResolvedValue([]);

    await app
      .get(TenderIngestionService)
      .collectAll(new Date("2026-08-27T03:00:00.000Z"));

    const tender = await dataSource.getRepository(Tender).findOneByOrFail({
      source: TenderSource.G2B,
      sourceNoticeId: NOTICE.sourceNoticeId,
      revision: NOTICE.revision,
    });
    expect(tender.relevance).toBe(TenderRelevance.DIRECT);
    expect(tender.relevanceReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ keyword: "LED" })]),
    );

    await request(app.getHttpServer())
      .get("/tenders/calendar?month=2026-08")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toContainEqual({
          date: "2026-08-27",
          total: 1,
          direct: 1,
          potential: 0,
        }),
      );
    await request(app.getHttpServer())
      .get("/tenders?registeredDate=2026-08-27&relevance=DIRECT")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.total).toBe(1));
    await request(app.getHttpServer())
      .get(`/tenders/${tender.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.rawData).toBeUndefined());
  });

  it("authenticates through the real JWT strategy and persists subscription settings", async () => {
    const payload = {
      enabled: true,
      deliveryTime: "12:30",
      recipients: ["sales@dfkorea.co.kr", "bid@dfkorea.co.kr"],
    };

    await request(app.getHttpServer())
      .put("/tenders/subscription")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(payload));
    await request(app.getHttpServer())
      .get("/tenders/subscription")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(payload));
    await request(app.getHttpServer())
      .put("/tenders/subscription")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...payload, keyword: "LED" })
      .expect(400);
  });

  it("keeps recipients isolated and makes exactly one due SMTP retry", async () => {
    g2b.fetchNotices.mockResolvedValue([NOTICE]);
    kapt.fetchNotices.mockResolvedValue([]);
    kepco.fetchNotices.mockResolvedValue([]);
    await app
      .get(TenderIngestionService)
      .collectAll(new Date("2026-08-27T03:00:00.000Z"));
    await request(app.getHttpServer())
      .put("/tenders/subscription")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        enabled: true,
        deliveryTime: "12:30",
        recipients: ["failed@example.com", "successful@example.com"],
      })
      .expect(200);

    transport.sendMail.mockImplementation(async ({ to }: { to: string }) => {
      const attempts = transport.sendMail.mock.calls.filter(
        ([message]) => message.to === to,
      ).length;
      if (to === "failed@example.com" && attempts === 1) {
        throw new Error("test SMTP failure");
      }
      return { messageId: `test-${to}` };
    });
    const service = app.get(TenderMailService);
    const firstAttempt = new Date("2026-08-27T03:30:00.000Z");
    await service.sendDailyDigest(firstAttempt);

    expect(
      transport.sendMail.mock.calls
        .map(([message]) => message.to)
        .filter((email) => email === "successful@example.com"),
    ).toEqual(["successful@example.com"]);
    const retry = await dataSource.getRepository(TenderMailDelivery).findOneByOrFail({
      recipientEmail: "failed@example.com",
      status: MailDeliveryStatus.RETRY_SCHEDULED,
    });
    expect(retry.attemptCount).toBe(1);

    await service.retryDue(new Date(firstAttempt.getTime() + 10 * 60 * 1000));

    expect(
      transport.sendMail.mock.calls
        .map(([message]) => message.to)
        .filter((email) => email === "failed@example.com"),
    ).toHaveLength(2);
    expect(
      transport.sendMail.mock.calls
        .map(([message]) => message.to)
        .filter((email) => email === "successful@example.com"),
    ).toEqual(["successful@example.com"]);
    await expect(
      dataSource.getRepository(TenderMailDelivery).findOneByOrFail({
        id: retry.id,
        status: MailDeliveryStatus.SENT,
      }),
    ).resolves.toEqual(expect.objectContaining({ attemptCount: 2 }));
  });
});

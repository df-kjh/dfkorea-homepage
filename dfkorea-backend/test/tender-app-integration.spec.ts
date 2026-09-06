import { SchedulerService } from "../src/scheduler/scheduler.service";
import { QuoteWorkerService } from "../src/quotes/quote-worker.service";
import { TenderAnalysisService } from "../src/tenders/services/tender-analysis.service";
import { TenderSchedulerService } from "../src/tenders/services/tender-scheduler.service";
import { TenderAnalysis } from "../src/tenders/entities/tender-analysis.entity";
import { TenderAnalysisReview } from "../src/tenders/entities/tender-analysis-review.entity";
import {
  G2B_TENDER_ENRICHMENT_ADAPTER,
  KAPT_TENDER_ENRICHMENT_ADAPTER,
  TENDER_DOCUMENT_FETCHER,
  emptyTenderEnrichment,
} from "../src/tenders/domain/tender-enrichment";
import { G2bAwardAdapter } from "../src/tenders/adapters/g2b-award.adapter";
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
import {
  TenderSourceAdapter,
  TenderSourceFetchResult,
} from "../src/tenders/domain/tender-source.adapter";
import {
  MailDeliveryStatus,
  ProcurementType,
  SyncRunStatus,
  TenderRelevance,
  TenderSource,
} from "../src/tenders/domain/tender.enums";
import { Tender } from "../src/tenders/entities/tender.entity";
import { TenderCompanyProfile } from "../src/tenders/entities/tender-company-profile.entity";
import { TenderMailDelivery } from "../src/tenders/entities/tender-mail-delivery.entity";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "../src/tenders/mail/mail-delivery-outcome";
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
  procurementType: ProcurementType.GOODS,
  contractMethod: null,
  estimatedAmount: "1000000",
  sourceUrl: "https://example.invalid/tender/test-g2b-1",
  itemName: "LED 등기구",
  description: "통합 테스트 fixture",
  attachmentNames: [],
  rawData: { fixture: true },
};

const enrichAnalysis = jest.fn(async () => emptyTenderEnrichment());

const successful = (
  notices: NormalizedTender[] = [],
): TenderSourceFetchResult => ({
  notices,
  status: SyncRunStatus.SUCCEEDED,
  errorCode: null,
  failures: [],
});

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
      if (migrationDataSource.isInitialized)
        await migrationDataSource.destroy();
    }

    process.env.NAVER_WORKS_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString(
      "base64",
    );

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SchedulerService)
      .useValue({})
      .overrideProvider(QuoteWorkerService)
      .useValue({})
      .overrideProvider(G2B_TENDER_ADAPTER)
      .useValue(g2b)
      .overrideProvider(KAPT_TENDER_ADAPTER)
      .useValue(kapt)
      .overrideProvider(KEPCO_TENDER_ADAPTER)
      .useValue(kepco)
      .overrideProvider(G2B_TENDER_ENRICHMENT_ADAPTER)
      .useValue({ enrich: enrichAnalysis })
      .overrideProvider(KAPT_TENDER_ENRICHMENT_ADAPTER)
      .useValue({ enrich: async () => emptyTenderEnrichment() })
      .overrideProvider(TENDER_DOCUMENT_FETCHER)
      .useValue({
        fetch: async () => {
          throw new Error("Unexpected document fetch");
        },
      })
      .overrideProvider(G2bAwardAdapter)
      .useValue({
        fetchWindow: async () => ({
          items: [],
          invalidations: [],
          fetchedCount: 0,
          excludedCount: 0,
          nextCursor: null,
          reviewCodes: [],
        }),
      })
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
    app.get(TenderSchedulerService).onModuleDestroy();

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
    enrichAnalysis
      .mockReset()
      .mockImplementation(async () => emptyTenderEnrichment());
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

  it("authenticates profile PUT, transactional queue, analysis GET and review POST with the actual admin identity", async () => {
    g2b.fetchNotices.mockResolvedValue(successful([NOTICE]));
    kapt.fetchNotices.mockResolvedValue(successful());
    kepco.fetchNotices.mockResolvedValue(successful());
    await app.get(TenderIngestionService).collectAll(new Date());
    const tender = await dataSource
      .getRepository(Tender)
      .findOneByOrFail({ sourceNoticeId: NOTICE.sourceNoticeId });
    const auth = { Authorization: `Bearer ${adminToken}` };
    await request(app.getHttpServer())
      .put("/tenders/company-profile")
      .set(auth)
      .send({
        companyName: "test",
        businessNumber: "1234567890",
        headquarters: { sido: "경기도", sigungu: "화성시" },
        g2bRegistered: true,
        supplyProducts: [],
        licenses: [],
        companyTypes: [],
        directProduction: [],
        certifications: [],
        performanceRecords: [],
      })
      .expect(200);
    expect(
      await dataSource
        .getRepository(TenderAnalysis)
        .findOneByOrFail({ tenderId: tender.id }),
    ).toMatchObject({ status: "PENDING" });
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/analysis`)
      .set(auth)
      .expect(202)
      .expect(({ body }) => expect(body.status).toBe("PENDING"));
    await app.get(TenderAnalysisService).processDue(new Date(), 1);
    const analysis = await request(app.getHttpServer())
      .get(`/tenders/${tender.id}/analysis`)
      .set(auth)
      .expect(200);
    expect(analysis.body).toMatchObject({
      status: "COMPLETED",
      reviewed: false,
    });
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/review`)
      .set(auth)
      .send({
        completed: true,
        note: "  checked  ",
        analysisFingerprint: analysis.body.analysisFingerprint,
      })
      .expect(201)
      .expect(({ body }) => expect(body.reviewed).toBe(true));
    await app.get(TenderIngestionService).collectAll(new Date());
    expect(
      await app.get(TenderAnalysisService).getAnalysis(tender.id),
    ).toMatchObject({ status: "COMPLETED", reviewed: true });
    const admin = await dataSource
      .getRepository(Admin)
      .findOneByOrFail({ username: "admin" });
    expect(
      await dataSource
        .getRepository(TenderAnalysisReview)
        .findOneByOrFail({ tenderId: tender.id }),
    ).toMatchObject({
      reviewerAdminId: admin.id,
      note: "checked",
      analysisFingerprint: analysis.body.analysisFingerprint,
    });
    await request(app.getHttpServer())
      .get("/tenders")
      .set(auth)
      .expect(200)
      .expect(({ body }) => {
        expect(Object.keys(body.data[0].analysis).sort()).toEqual([
          "analyzedAt",
          "specificationScore",
          "status",
          "suitability",
          "unknownCount",
        ]);
        expect(JSON.stringify(body)).not.toMatch(
          /textBlocks|tableBlocks|processingToken/,
        );
      });
    g2b.fetchNotices.mockResolvedValue(
      successful([
        { ...NOTICE, rawData: { changedSpecification: "fixture change" } },
      ]),
    );
    await app.get(TenderIngestionService).collectAll(new Date());
    expect(
      await app.get(TenderAnalysisService).getAnalysis(tender.id),
    ).toMatchObject({ status: "PENDING", reviewed: false });
    expect(await dataSource.getRepository(TenderAnalysisReview).count()).toBe(
      1,
    );
    await request(app.getHttpServer())
      .post("/tenders/award-results/backfill")
      .set(auth)
      .expect(202);
    await request(app.getHttpServer())
      .get("/tenders/award-results/status")
      .set(auth)
      .expect(200);
  });

  it("bounds persisted and legacy formula/qualification detail through authenticated HTTP and invalidates a hidden tail change", async () => {
    g2b.fetchNotices.mockResolvedValue(successful([NOTICE]));
    kapt.fetchNotices.mockResolvedValue(successful());
    kepco.fetchNotices.mockResolvedValue(successful());
    await app.get(TenderIngestionService).collectAll(new Date());
    const tender = await dataSource
      .getRepository(Tender)
      .findOneByOrFail({ sourceNoticeId: NOTICE.sourceNoticeId });
    const bulk = "제공자본문".repeat(28000);
    const enrichment = emptyTenderEnrichment();
    enrichment.formulaVariables = [
      {
        key: "plannedPriceMethod",
        value: `${bulk}A`,
        evidence: { source: "G2B_API", operation: "fixture", field: "formula" },
      },
    ];
    enrichAnalysis.mockResolvedValue(enrichment);
    const auth = { Authorization: `Bearer ${adminToken}` };
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/analysis`)
      .set(auth)
      .expect(202);
    await app.get(TenderAnalysisService).processDue(new Date(), 1);
    const stored = await dataSource
      .getRepository(TenderAnalysis)
      .findOneByOrFail({ tenderId: tender.id });
    expect(stored.reviewSemanticDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored.priceAnalysis).length).toBeLessThan(3000);
    const before = await request(app.getHttpServer())
      .get(`/tenders/${tender.id}/analysis`)
      .set(auth)
      .expect(200);
    expect(Buffer.byteLength(JSON.stringify(before.body))).toBeLessThan(30000);
    expect(
      before.body.evidence.some(
        (value) => value.diagnosticCategory === "TRUNCATION",
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/review`)
      .set(auth)
      .send({
        completed: true,
        note: "checked",
        analysisFingerprint: (
          await app.get(TenderAnalysisService).getAnalysis(tender.id)
        ).analysisFingerprint,
      })
      .expect(201)
      .expect(({ body }) => expect(body.reviewed).toBe(true));
    enrichment.formulaVariables[0].value = `${bulk}B`;
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/analysis`)
      .set(auth)
      .expect(202);
    await app.get(TenderAnalysisService).processDue(new Date(), 1);
    const after = await request(app.getHttpServer())
      .get(`/tenders/${tender.id}/analysis`)
      .set(auth)
      .expect(200);
    expect(after.body.reviewed).toBe(false);
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/review`)
      .set(auth)
      .send({
        completed: true,
        note: "old browser snapshot",
        analysisFingerprint: before.body.analysisFingerprint,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/review`)
      .set(auth)
      .send({ completed: true, note: "missing fingerprint" })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/tenders/${tender.id}/review`)
      .set(auth)
      .send({
        completed: true,
        analysisFingerprint: after.body.analysisFingerprint,
        reviewerAdminId: 999,
      })
      .expect(400);
    expect(after.body.analysisFingerprint).not.toBe(
      before.body.analysisFingerprint,
    );
    expect(after.body.priceAnalysis.formula.plannedPriceMethod).toBe(
      before.body.priceAnalysis.formula.plannedPriceMethod,
    );
    expect(await dataSource.getRepository(TenderAnalysisReview).count()).toBe(
      1,
    );
    await dataSource.getRepository(TenderAnalysis).update(stored.id, {
      reviewSemanticDigest: null,
      participationAnalysis: {
        requirements: [{ id: "legacy", label: bulk, values: [bulk] }],
        providerPayload: bulk,
      },
    });
    await request(app.getHttpServer())
      .get(`/tenders/${tender.id}/analysis`)
      .set(auth)
      .expect(200)
      .expect(({ body }) => {
        expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(30000);
        expect(JSON.stringify(body)).not.toContain(bulk);
        expect(JSON.stringify(body)).not.toContain("providerPayload");
      });
  });

  it("uses real TypeORM storage for mocked-adapter ingestion and authenticated queries", async () => {
    g2b.fetchNotices.mockResolvedValue(successful([NOTICE]));
    kapt.fetchNotices.mockResolvedValue(successful());
    kepco.fetchNotices.mockResolvedValue(successful());

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
      .expect(({ body }) =>
        expect(body).toEqual({
          ...payload,
          recipients: [...payload.recipients].sort(),
        }),
      );
    await request(app.getHttpServer())
      .get("/tenders/subscription")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({
          ...payload,
          recipients: [...payload.recipients].sort(),
        }),
      );
    await request(app.getHttpServer())
      .put("/tenders/subscription")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...payload, keyword: "LED" })
      .expect(400);
  });

  it("serializes concurrent initial company qualification profile replacements", async () => {
    const profile = {
      companyName: "디에프코리아",
      businessNumber: "123-45-67890",
      headquarters: { sido: "경기도", sigungu: "화성시" },
      g2bRegistered: true,
      supplyProducts: [],
      licenses: [],
      companyTypes: [],
      directProduction: [],
      certifications: [],
      performanceRecords: [],
    };

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .put("/tenders/company-profile")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(profile)
        .expect(200),
      request(app.getHttpServer())
        .put("/tenders/company-profile")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...profile, companyName: "디에프코리아 주식회사" })
        .expect(200),
    ]);

    expect([first.body.version, second.body.version].sort()).toEqual([1, 2]);
    expect(first.body.businessNumber).toBe("1234567890");
    expect(second.body.businessNumber).toBe("1234567890");

    await expect(
      dataSource.getRepository(TenderCompanyProfile).find(),
    ).resolves.toEqual([
      expect.objectContaining({ singletonKey: "company", version: 2 }),
    ]);
  });

  it("keeps recipients isolated and makes exactly one due provider retry", async () => {
    g2b.fetchNotices.mockResolvedValue(successful([NOTICE]));
    kapt.fetchNotices.mockResolvedValue(successful());
    kepco.fetchNotices.mockResolvedValue(successful());
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
        throw new MailDeliveryError(MailDeliveryOutcome.RETRYABLE_REJECTION);
      }
      return { providerMessageId: `test-${to}` };
    });
    const service = app.get(TenderMailService);
    const firstAttempt = new Date("2026-08-27T03:30:00.000Z");
    await service.sendDailyDigest(firstAttempt);

    expect(
      transport.sendMail.mock.calls
        .map(([message]) => message.to)
        .filter((email) => email === "successful@example.com"),
    ).toEqual(["successful@example.com"]);
    const retry = await dataSource
      .getRepository(TenderMailDelivery)
      .findOneByOrFail({
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

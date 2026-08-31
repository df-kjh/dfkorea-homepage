import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import { TenderQueryService } from "../src/tenders/services/tender-query.service";
import { TenderSubscriptionService } from "../src/tenders/services/tender-subscription.service";
import { TendersController } from "../src/tenders/tenders.controller";
import { TenderClassifier } from "../src/tenders/domain/tender-classifier";
import { TenderOpportunityClassifier } from "../src/tenders/domain/tender-opportunity-classifier";
import {
  ProcurementType,
  MailDeliveryStatus,
  MailItemStatus,
  TenderRelevance,
  TenderSource,
  SyncRunStatus,
  TenderOpportunityType,
} from "../src/tenders/domain/tender.enums";
import { NormalizedTender } from "../src/tenders/domain/normalized-tender";
import {
  TenderSourceAdapter,
  TenderSourceFetchResult,
} from "../src/tenders/domain/tender-source.adapter";
import { Tender } from "../src/tenders/entities/tender.entity";
import { TenderMailDelivery } from "../src/tenders/entities/tender-mail-delivery.entity";
import { TenderRecipient } from "../src/tenders/entities/tender-recipient.entity";
import { TenderIngestionService } from "../src/tenders/services/tender-ingestion.service";
import { TenderMailService } from "../src/tenders/services/tender-mail.service";
import { TenderMailRenderer } from "../src/tenders/mail/tender-mail-renderer";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "../src/tenders/mail/mail-delivery-outcome";
import { TenderDailyDispatch } from "../src/tenders/entities/tender-daily-dispatch.entity";

const ADMIN_TOKEN = "test-admin-token";
const TENDER_ID = "00000000-0000-4000-8000-000000000001";

describe("Tender admin HTTP contract", () => {
  let app: INestApplication | undefined;
  const query = {
    getCalendar: jest.fn(),
    getTenders: jest.fn(),
    getTender: jest.fn(),
  };
  const subscription = {
    getOrCreate: jest.fn(),
    update: jest.fn(),
  };
  const ingestion = {
    collectAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    query.getCalendar.mockResolvedValue([
      { date: "2026-08-27", total: 2, direct: 1, potential: 1 },
    ]);
    query.getTenders.mockResolvedValue({
      data: [{ id: TENDER_ID, title: "LED 가로등 교체공사" }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    query.getTender.mockResolvedValue({
      id: TENDER_ID,
      title: "LED 가로등 교체공사",
      relevance: "DIRECT",
    });
    subscription.getOrCreate.mockResolvedValue({
      enabled: false,
      deliveryTime: "09:00",
      recipients: [],
    });
    subscription.update.mockResolvedValue({
      enabled: true,
      deliveryTime: "12:30",
      recipients: ["sales@dfkorea.co.kr"],
    });
    ingestion.collectAll.mockResolvedValue({
      lockAcquired: true,
      collectedAt: new Date("2026-08-31T00:00:00.000Z"),
      sources: [
        {
          source: TenderSource.G2B,
          status: SyncRunStatus.PARTIAL,
          fetchedCount: 2,
          createdCount: 1,
          updatedCount: 1,
          excludedCount: 0,
          errorCode: "LICENSE_LIMIT_UNAVAILABLE",
        },
        {
          source: TenderSource.KEPCO,
          status: SyncRunStatus.FAILED,
          fetchedCount: 0,
          createdCount: 0,
          updatedCount: 0,
          excludedCount: 0,
          errorCode: "SOURCE_UNAVAILABLE",
        },
      ],
      failedSources: [TenderSource.KEPCO],
    });

    const module = await Test.createTestingModule({
      controllers: [TendersController],
      providers: [
        { provide: TenderQueryService, useValue: query },
        { provide: TenderSubscriptionService, useValue: subscription },
        { provide: TenderIngestionService, useValue: ingestion },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const authorization = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string | undefined> }>()
            .headers.authorization;
          if (authorization !== `Bearer ${ADMIN_TOKEN}`) {
            throw new UnauthorizedException();
          }
          return true;
        },
      })
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
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("rejects an unauthenticated calendar request", async () => {
    await request(app!.getHttpServer())
      .get("/tenders/calendar?month=2026-08")
      .expect(401);
  });

  it("rejects an unauthenticated manual collection request", async () => {
    await request(app!.getHttpServer()).post("/tenders/collect").expect(401);
  });

  it("returns the authenticated manual collection summary", async () => {
    await request(app!.getHttpServer())
      .post("/tenders/collect")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          lockAcquired: true,
          collectedAt: "2026-08-31T00:00:00.000Z",
          sources: [
            {
              source: "G2B",
              status: "PARTIAL",
              fetchedCount: 2,
              createdCount: 1,
              updatedCount: 1,
              excludedCount: 0,
              errorCode: "LICENSE_LIMIT_UNAVAILABLE",
            },
            {
              source: "KEPCO",
              status: "FAILED",
              fetchedCount: 0,
              createdCount: 0,
              updatedCount: 0,
              excludedCount: 0,
              errorCode: "SOURCE_UNAVAILABLE",
            },
          ],
          failedSources: ["KEPCO"],
        });
      });
    expect(ingestion.collectAll).toHaveBeenCalledWith(expect.any(Date));
  });

  it("serves the authenticated calendar, list, and safe detail contracts", async () => {
    await request(app!.getHttpServer())
      .get("/tenders/calendar?month=2026-08&source=G2B")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toContainEqual({
          date: "2026-08-27",
          total: 2,
          direct: 1,
          potential: 1,
        });
      });
    expect(query.getCalendar).toHaveBeenCalledWith(
      "2026-08",
      expect.objectContaining({ source: "G2B" }),
    );

    await request(app!.getHttpServer())
      .get("/tenders?registeredDate=2026-08-27&relevance=DIRECT")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .expect(200)
      .expect(({ body }) => expect(body.total).toBe(1));
    expect(query.getTenders).toHaveBeenCalledWith(
      expect.objectContaining({
        registeredDate: "2026-08-27",
        relevance: "DIRECT",
      }),
    );

    await request(app!.getHttpServer())
      .get(`/tenders/${TENDER_ID}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({ id: TENDER_ID, relevance: "DIRECT" }),
        );
        expect(body.rawData).toBeUndefined();
      });
  });

  it("returns not found when an excluded tender is hidden by detail lookup", async () => {
    query.getTender.mockResolvedValueOnce(null);

    await request(app!.getHttpServer())
      .get(`/tenders/${TENDER_ID}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            statusCode: 404,
            message: "Tender not found",
          }),
        );
      });
  });

  it("stores only shared recipient and delivery-time settings", async () => {
    const payload = {
      enabled: true,
      deliveryTime: "12:30",
      recipients: ["sales@dfkorea.co.kr"],
    };
    await request(app!.getHttpServer())
      .put("/tenders/subscription")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send(payload)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(payload));
    expect(subscription.update).toHaveBeenCalledWith(payload);

    await request(app!.getHttpServer())
      .put("/tenders/subscription")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ ...payload, keyword: "LED" })
      .expect(400);
  });

  it("rejects display-filter query parameters on the subscription endpoint", async () => {
    await request(app!.getHttpServer())
      .get("/tenders/subscription?keyword=LED")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .expect(400);
  });
});

describe("Tender collection and delivery service contracts", () => {
  const now = new Date("2026-08-27T03:00:00.000Z");

  const notice = (overrides: Partial<NormalizedTender>): NormalizedTender => ({
    source: TenderSource.G2B,
    sourceNoticeId: "G2B-1",
    revision: "000",
    title: "LED 가로등 교체공사",
    orderingOrganization: "서울특별시",
    demandOrganization: null,
    registeredAt: new Date("2026-08-26T06:30:00.000Z"),
    bidStartedAt: null,
    bidEndedAt: null,
    openedAt: null,
    region: "서울",
    procurementType: ProcurementType.CONSTRUCTION,
    contractMethod: null,
    estimatedAmount: "1000000",
    sourceUrl: "https://example.invalid/tender",
    itemName: "LED 등기구",
    description: "",
    attachmentNames: [],
    licenseLimits: [],
    licenseLimitsVerified: true,
    rawData: { notice: "sanitized fixture" },
    ...overrides,
  });

  const successfulFetch = (
    notices: NormalizedTender[] = [],
  ): TenderSourceFetchResult => ({
    notices,
    status: SyncRunStatus.SUCCEEDED,
    errorCode: null,
  });

  it("runs mocked source adapters through classification and conflict upsert", async () => {
    const g2b = {
      source: TenderSource.G2B,
      fetchNotices: jest.fn().mockResolvedValue(successfulFetch([notice({})])),
    } as jest.Mocked<TenderSourceAdapter>;
    const kapt = {
      source: TenderSource.KAPT,
      fetchNotices: jest.fn().mockResolvedValue(
        successfulFetch([
          notice({
            source: TenderSource.KAPT,
            sourceNoticeId: "KAPT-1",
            title: "지하주차장 전기시설 개선공사",
            itemName: "",
            description: "",
          }),
        ]),
      ),
    } as jest.Mocked<TenderSourceAdapter>;
    const kepco = {
      source: TenderSource.KEPCO,
      fetchNotices: jest.fn().mockResolvedValue(
        successfulFetch([
          notice({
            source: TenderSource.KEPCO,
            sourceNoticeId: "KEPCO-ignored",
            title: "구내식당 식자재 구매",
            itemName: "",
          }),
        ]),
      ),
    } as jest.Mocked<TenderSourceAdapter>;
    const tenderRepository = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
    };
    const syncRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest
        .fn()
        .mockImplementation(async (value) => ({ id: "run", ...value })),
    };
    const lockRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ locked: true }]),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(lockRunner),
      transaction: jest
        .fn()
        .mockImplementation(async (work) =>
          work({ getRepository: () => tenderRepository }),
        ),
    };
    const service = new TenderIngestionService(
      dataSource as never,
      syncRunRepository as never,
      new TenderClassifier(),
      new TenderOpportunityClassifier(),
      [g2b, kapt, kepco],
    );

    const summary = await service.collectAll(now);

    expect(summary).toEqual(
      expect.objectContaining({ lockAcquired: true, failedSources: [] }),
    );
    expect(g2b.fetchNotices).toHaveBeenCalledWith({
      from: new Date("2026-08-26T03:00:00.000Z"),
      to: now,
    });
    expect(tenderRepository.upsert).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          source: TenderSource.G2B,
          relevance: TenderRelevance.DIRECT,
          relevanceReasons: expect.arrayContaining([
            expect.objectContaining({ keyword: "LED" }),
          ]),
        }),
      ],
      { conflictPaths: ["source", "sourceNoticeId", "revision"] },
    );
    expect(tenderRepository.upsert).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          source: TenderSource.KAPT,
          relevance: TenderRelevance.POTENTIAL,
          relevanceReasons: expect.arrayContaining([
            expect.objectContaining({ keyword: "전기시설" }),
          ]),
        }),
      ],
      { conflictPaths: ["source", "sourceNoticeId", "revision"] },
    );
    expect(syncRunRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TenderSource.KEPCO,
        excludedCount: 1,
      }),
    );
  });

  it("isolates recipients and makes one due retry without resending a success", async () => {
    const failedRecipient = {
      id: "recipient-failed",
      email: "failed@dfkorea.co.kr",
      isActive: true,
    } as TenderRecipient;
    const successfulRecipient = {
      id: "recipient-success",
      email: "success@dfkorea.co.kr",
      isActive: true,
    } as TenderRecipient;
    const tender = {
      id: TENDER_ID,
      ...notice({}),
      relevance: TenderRelevance.DIRECT,
      relevanceScore: 100,
      relevanceReasons: [],
      opportunityType: TenderOpportunityType.GOODS_SUPPLY,
      opportunityReasons: ["물품 업무구분"],
      firstCollectedAt: now,
      lastUpdatedAt: now,
    } as Tender;
    let deliverySequence = 0;
    let retryDelivery: TenderMailDelivery | undefined;
    const deliveries = new Map<string, TenderMailDelivery>();
    const deliveryRepository = {
      save: jest.fn(async (value: Partial<TenderMailDelivery>) => {
        const saved = {
          id: value.id ?? `delivery-${++deliverySequence}`,
          ...value,
        } as TenderMailDelivery;
        deliveries.set(saved.id, saved);
        if (saved.status === MailDeliveryStatus.RETRY_SCHEDULED) {
          retryDelivery = saved;
        }
        return saved;
      }),
      findOne: jest.fn(
        async (options: {
          where: { dailyDispatchId: string; recipientId: string };
        }) =>
          [...deliveries.values()].find(
            (delivery) =>
              delivery.dailyDispatchId === options.where.dailyDispatchId &&
              delivery.recipientId === options.where.recipientId,
          ) ?? null,
      ),
      find: jest.fn(
        async (options: { where: { status: MailDeliveryStatus } }) =>
          options.where.status === MailDeliveryStatus.PENDING
            ? []
            : retryDelivery
              ? [retryDelivery]
              : [],
      ),
      update: jest.fn(
        async (
          criteria: { id: string },
          changes: Partial<TenderMailDelivery>,
        ) => {
          const current = deliveries.get(criteria.id);
          if (!current) return { affected: 0 };
          const updated = { ...current, ...changes } as TenderMailDelivery;
          deliveries.set(updated.id, updated);
          if (updated.recipientEmail === failedRecipient.email) {
            retryDelivery = updated;
          }
          return { affected: 1 };
        },
      ),
    };
    const mailItemRepository = {
      find: jest.fn(async (options: { where: Record<string, string> }) => {
        if (options.where.recipientId) return [];
        return retryDelivery
          ? [
              {
                recipientId: failedRecipient.id,
                tenderId: tender.id,
                tender,
                status: MailItemStatus.PENDING,
                lastDeliveryId: retryDelivery.id,
              },
            ]
          : [];
      }),
      save: jest.fn(async (value) => value),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const subscriptionRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: "subscription",
        enabled: true,
        deliveryTime: "09:00",
        recipients: [failedRecipient, successfulRecipient],
      }),
    };
    const dispatchBuilder = {
      insert: jest.fn(),
      values: jest.fn(),
      orIgnore: jest.fn(),
      returning: jest.fn(),
      execute: jest.fn().mockResolvedValue({ raw: [{ id: "dispatch-1" }] }),
    };
    Object.values(dispatchBuilder).forEach((method) => {
      if (method !== dispatchBuilder.execute) method.mockReturnValue(dispatchBuilder);
    });
    const dailyDispatchRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(dispatchBuilder),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const transport = {
      sendMail: jest.fn(async (message: { to: string }) => {
        const failedAttempts = transport.sendMail.mock.calls.filter(
          ([call]) => call.to === failedRecipient.email,
        ).length;
        if (message.to === failedRecipient.email && failedAttempts === 1) {
          throw new MailDeliveryError(
            MailDeliveryOutcome.RETRYABLE_REJECTION,
          );
        }
        return { providerMessageId: `provider-${message.to}` };
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (work) =>
        work({
          getRepository: (entity: unknown) => {
            if (entity === Tender)
              return { find: jest.fn().mockResolvedValue([tender]) };
            if (entity === TenderMailDelivery) return deliveryRepository;
            if (entity === TenderDailyDispatch) return dailyDispatchRepository;
            return mailItemRepository;
          },
        }),
      ),
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([{ locked: true }]),
        release: jest.fn().mockResolvedValue(undefined),
      })),
    };
    const service = new TenderMailService(
      dataSource as never,
      subscriptionRepository as never,
      { findOne: jest.fn().mockResolvedValue(failedRecipient) } as never,
      { find: jest.fn().mockResolvedValue([tender]) } as never,
      deliveryRepository as never,
      mailItemRepository as never,
      dailyDispatchRepository as never,
      new TenderMailRenderer(),
      transport as never,
    );

    await service.sendDailyDigest(now);
    expect(retryDelivery).toEqual(
      expect.objectContaining({
        attemptCount: 1,
        nextRetryAt: new Date(now.getTime() + 10 * 60_000),
      }),
    );
    await service.retryDue(new Date(now.getTime() + 10 * 60_000));

    const sentTo = transport.sendMail.mock.calls.map(([message]) => message.to);
    expect(
      sentTo.filter((email) => email === successfulRecipient.email),
    ).toEqual([successfulRecipient.email]);
    expect(
      sentTo.filter((email) => email === failedRecipient.email),
    ).toHaveLength(2);
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: retryDelivery?.id,
        status: MailDeliveryStatus.RETRY_SCHEDULED,
      }),
      expect.objectContaining({ attemptCount: 2 }),
    );
  });
});

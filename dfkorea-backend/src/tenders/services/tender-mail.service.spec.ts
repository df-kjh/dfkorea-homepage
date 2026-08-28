import {
  DailyDispatchStatus,
  MailDeliveryStatus,
  MailItemStatus,
  ProcurementType,
  TenderRelevance,
  TenderSource,
} from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import { TenderMailDelivery } from "../entities/tender-mail-delivery.entity";
import { TenderRecipient } from "../entities/tender-recipient.entity";
import { TenderDailyDispatch } from "../entities/tender-daily-dispatch.entity";
import { TenderMailRenderer } from "../mail/tender-mail-renderer";
import { TenderMailService } from "./tender-mail.service";

const NOW = new Date("2026-08-27T01:00:00.000Z");
const RECIPIENT = {
  id: "recipient-1",
  email: "sales@dfkorea.co.kr",
  isActive: true,
} as TenderRecipient;
const TENDER = {
  id: "tender-1",
  title: "LED 교체",
  orderingOrganization: "DF",
  demandOrganization: null,
  source: TenderSource.G2B,
  sourceNoticeId: "N-1",
  revision: "00",
  registeredAt: NOW,
  bidStartedAt: null,
  bidEndedAt: null,
  openedAt: null,
  region: null,
  procurementType: ProcurementType.CONSTRUCTION,
  contractMethod: null,
  estimatedAmount: null,
  sourceUrl: "https://example.com",
  relevance: TenderRelevance.DIRECT,
  relevanceScore: 100,
  relevanceReasons: [{ field: "title", keyword: "LED", score: 100 }],
  rawData: {},
  firstCollectedAt: NOW,
  lastUpdatedAt: NOW,
} as Tender;

describe("TenderMailService", () => {
  let subscriptionRepository: any;
  let recipientRepository: any;
  let tenderRepository: any;
  let deliveryRepository: any;
  let mailItemRepository: any;
  let dailyDispatchRepository: any;
  let transport: { sendMail: jest.Mock };
  let dataSource: any;
  let service: TenderMailService;

  beforeEach(() => {
    subscriptionRepository = {
      findOne: jest.fn().mockResolvedValue({
        enabled: true,
        deliveryTime: "09:00",
        recipients: [{ ...RECIPIENT, isActive: true }],
      }),
    };
    recipientRepository = { findOne: jest.fn().mockResolvedValue(RECIPIENT) };
    tenderRepository = { find: jest.fn().mockResolvedValue([TENDER]) };
    deliveryRepository = {
      save: jest.fn(async (value) => ({ id: "delivery-1", ...value })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mailItemRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (value) => (Array.isArray(value) ? value : value)),
      update: jest.fn(),
    };
    const dispatchBuilder = {
      insert: jest.fn(),
      values: jest.fn(),
      orIgnore: jest.fn(),
      returning: jest.fn(),
      execute: jest.fn().mockResolvedValue({ raw: [{ id: "dispatch-1" }] }),
    };
    Object.values(dispatchBuilder).forEach((method) => {
      if (method !== dispatchBuilder.execute)
        method.mockReturnValue(dispatchBuilder);
    });
    dailyDispatchRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(dispatchBuilder),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };
    transport = {
      sendMail: jest.fn().mockResolvedValue({ messageId: "smtp-1" }),
    };
    dataSource = {
      transaction: jest.fn((callback) =>
        callback({
          getRepository: jest.fn((entity) =>
            entity === Tender
              ? tenderRepository
              : entity === TenderMailDelivery
                ? deliveryRepository
                : entity === TenderDailyDispatch
                  ? dailyDispatchRepository
                  : mailItemRepository,
          ),
        }),
      ),
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(),
        release: jest.fn(),
        query: jest.fn().mockResolvedValue([{ locked: true }]),
      })),
    };
    service = new TenderMailService(
      dataSource,
      subscriptionRepository,
      recipientRepository,
      tenderRepository,
      deliveryRepository,
      mailItemRepository,
      dailyDispatchRepository,
      {
        get: jest.fn(
          (key: string) =>
            ({
              SMTP_HOST: "smtp.worksmobile.com",
              SMTP_PORT: "465",
              SMTP_SECURE: "true",
              SMTP_USER: "sender@dfkorea.co.kr",
              SMTP_APP_PASSWORD: "secret",
              SMTP_FROM_NAME: "DF KOREA 입찰정보",
            })[key],
        ),
      } as never,
      new TenderMailRenderer(),
      transport as never,
    );
  });

  it("sends each enabled recipient independently and marks only that recipient's items sent", async () => {
    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: RECIPIENT.email }),
    );
    expect(mailItemRepository.update).toHaveBeenCalledWith(
      { lastDeliveryId: "delivery-1" },
      expect.objectContaining({ status: MailItemStatus.SENT, sentAt: NOW }),
    );
    expect(deliveryRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: MailDeliveryStatus.SENT,
        attemptCount: 1,
      }),
    );
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyDispatchId: "dispatch-1",
        recipientId: RECIPIENT.id,
      }),
    );
    expect(dataSource.transaction).toHaveBeenCalledTimes(3);
  });

  it.each([
    MailDeliveryStatus.SENT,
    MailDeliveryStatus.RETRY_SCHEDULED,
    MailDeliveryStatus.PENDING,
    MailDeliveryStatus.DELIVERY_UNCERTAIN,
    MailDeliveryStatus.CANCELLED,
    MailDeliveryStatus.FAILED,
    MailDeliveryStatus.SKIPPED,
  ])(
    "does not duplicate a recipient with durable %s state when a stale dispatch resumes",
    async (status) => {
      deliveryRepository.findOne.mockResolvedValue({
        id: "existing-delivery",
        dailyDispatchId: "dispatch-1",
        recipientId: RECIPIENT.id,
        status,
      });

      await service.sendDailyDigest(NOW);

      expect(transport.sendMail).not.toHaveBeenCalled();
      expect(deliveryRepository.save).not.toHaveBeenCalled();
      expect(dailyDispatchRepository.update).toHaveBeenCalledWith(
        "dispatch-1",
        expect.objectContaining({ status: DailyDispatchStatus.COMPLETED }),
      );
    },
  );

  it("resumes only the recipient missing a durable dispatch outcome", async () => {
    const durableRecipient = {
      id: "recipient-durable",
      email: "durable@dfkorea.co.kr",
      isActive: true,
    } as TenderRecipient;
    const missingRecipient = {
      id: "recipient-missing",
      email: "missing@dfkorea.co.kr",
      isActive: true,
    } as TenderRecipient;
    subscriptionRepository.findOne.mockResolvedValue({
      enabled: true,
      deliveryTime: "09:00",
      recipients: [durableRecipient, missingRecipient],
    });
    deliveryRepository.findOne.mockImplementation(({ where }) =>
      Promise.resolve(
        where.recipientId === durableRecipient.id
          ? { id: "durable-delivery", status: MailDeliveryStatus.SENT }
          : null,
      ),
    );

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: missingRecipient.email }),
    );
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyDispatchId: "dispatch-1",
        recipientId: missingRecipient.id,
      }),
    );
  });

  it("fetches and keeps the concurrent durable delivery after a unique conflict", async () => {
    dataSource.transaction
      .mockImplementationOnce((callback) =>
        callback({
          getRepository: jest.fn(() => dailyDispatchRepository),
        }),
      )
      .mockRejectedValueOnce({ code: "23505" });
    deliveryRepository.findOne.mockResolvedValue({
      id: "winner-delivery",
      dailyDispatchId: "dispatch-1",
      recipientId: RECIPIENT.id,
      status: MailDeliveryStatus.PENDING,
    });

    await expect(service.sendDailyDigest(NOW)).resolves.toBeUndefined();

    expect(deliveryRepository.findOne).toHaveBeenCalledWith({
      where: {
        dailyDispatchId: "dispatch-1",
        recipientId: RECIPIENT.id,
      },
    });
    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(dailyDispatchRepository.update).toHaveBeenCalledWith(
      "dispatch-1",
      expect.objectContaining({ status: DailyDispatchStatus.COMPLETED }),
    );
  });

  it("lets only one of two replicas claim the same KST business date", async () => {
    const secondService = new TenderMailService(
      dataSource,
      subscriptionRepository,
      recipientRepository,
      tenderRepository,
      deliveryRepository,
      mailItemRepository,
      dailyDispatchRepository,
      {
        get: jest.fn(
          (key: string) =>
            ({
              SMTP_HOST: "smtp.worksmobile.com",
              SMTP_USER: "sender@dfkorea.co.kr",
              SMTP_APP_PASSWORD: "secret",
              SMTP_FROM_NAME: "DF KOREA",
            })[key],
        ),
      } as never,
      new TenderMailRenderer(),
      transport as never,
    );
    dailyDispatchRepository
      .createQueryBuilder()
      .execute.mockResolvedValueOnce({ raw: [{ id: "dispatch-1" }] })
      .mockResolvedValueOnce({ raw: [] });

    await service.sendDailyDigest(NOW);
    await secondService.sendDailyDigest(NOW);

    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  it("waits for the newly shared time, then claims the KST date once even if the time changes again", async () => {
    subscriptionRepository.findOne
      .mockResolvedValueOnce({
        enabled: true,
        deliveryTime: "11:00",
        recipients: [{ ...RECIPIENT, isActive: true }],
      })
      .mockResolvedValue({
        enabled: true,
        deliveryTime: "09:00",
        recipients: [{ ...RECIPIENT, isActive: true }],
      });

    await service.sendDailyDigest(NOW);
    expect(transport.sendMail).not.toHaveBeenCalled();

    await service.sendDailyDigest(NOW);
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(
      dailyDispatchRepository.createQueryBuilder().orIgnore,
    ).toHaveBeenCalled();

    dailyDispatchRepository
      .createQueryBuilder()
      .execute.mockResolvedValueOnce({ raw: [] });
    await service.sendDailyDigest(new Date("2026-08-27T05:00:00.000Z"));
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  it("leaves a successful SMTP delivery leased when its atomic success persistence fails", async () => {
    mailItemRepository.update.mockRejectedValueOnce(
      new Error("simulated item-write failure"),
    );

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MailDeliveryStatus.PENDING,
        claimedAt: NOW,
      }),
    );
    expect(deliveryRepository.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: MailDeliveryStatus.SENT }),
    );
    expect(deliveryRepository.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: MailDeliveryStatus.RETRY_SCHEDULED }),
    );
  });

  it("schedules exactly one durable retry ten minutes after a first SMTP failure", async () => {
    transport.sendMail.mockRejectedValueOnce({
      code: "EENVELOPE",
      command: "RCPT TO",
      responseCode: 550,
      message: "mailbox rejected",
    });

    await service.sendDailyDigest(NOW);

    expect(deliveryRepository.update).toHaveBeenLastCalledWith(
      {
        id: "delivery-1",
        status: MailDeliveryStatus.PENDING,
        claimedAt: NOW,
      },
      expect.objectContaining({
        status: MailDeliveryStatus.RETRY_SCHEDULED,
        attemptCount: 1,
        nextRetryAt: new Date(NOW.getTime() + 10 * 60_000),
      }),
    );
    expect(mailItemRepository.update).not.toHaveBeenCalled();
  });

  it.each([
    { code: "ETIMEDOUT", command: "CONN" },
    { code: "ECONNECTION", command: "CONN" },
    { code: "ETIMEDOUT", command: "DATA" },
    { code: "ECONNRESET", command: "DATA" },
    { code: "ETIMEDOUT" },
  ])(
    "marks ambiguous SMTP error $code/$command terminal without retry",
    async (smtpError) => {
      transport.sendMail.mockRejectedValueOnce(smtpError);

      await service.sendDailyDigest(NOW);

      expect(deliveryRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: "delivery-1" }),
        expect.objectContaining({
          status: MailDeliveryStatus.DELIVERY_UNCERTAIN,
          nextRetryAt: null,
          uncertainAt: NOW,
        }),
      );
      expect(mailItemRepository.update).toHaveBeenCalledWith(
        { lastDeliveryId: "delivery-1", status: MailItemStatus.PENDING },
        { status: MailItemStatus.DELIVERY_UNCERTAIN, uncertainAt: NOW },
      );
    },
  );

  it("keeps a claimed dispatch resumable when recipient DB work fails before a durable delivery", async () => {
    let transactionCall = 0;
    dataSource.transaction.mockImplementation(async (callback) => {
      transactionCall += 1;
      if (transactionCall === 2) throw new Error("claim write failed");
      return callback({
        getRepository: jest.fn((entity) =>
          entity === TenderDailyDispatch
            ? dailyDispatchRepository
            : entity === Tender
              ? tenderRepository
              : entity === TenderMailDelivery
                ? deliveryRepository
                : mailItemRepository,
        ),
      });
    });
    dailyDispatchRepository.update.mockRejectedValueOnce(
      new Error("lastError audit write failed"),
    );

    await expect(service.sendDailyDigest(NOW)).rejects.toThrow(
      "claim write failed",
    );
    expect(dailyDispatchRepository.update).toHaveBeenCalledWith(
      "dispatch-1",
      expect.objectContaining({
        status: DailyDispatchStatus.CLAIMED,
        lastError: "Recipient delivery claim failed before durable state",
      }),
    );
    expect(dailyDispatchRepository.update).not.toHaveBeenCalledWith(
      "dispatch-1",
      expect.objectContaining({ status: DailyDispatchStatus.COMPLETED }),
    );
  });

  it("reclaims a stale daily dispatch lease but skips a fresh replica claim", async () => {
    const builder = dailyDispatchRepository.createQueryBuilder();
    builder.execute.mockResolvedValue({ raw: [] });
    dailyDispatchRepository.findOne = jest
      .fn()
      .mockResolvedValueOnce({
        id: "stale-dispatch",
        status: DailyDispatchStatus.CLAIMED,
        leaseExpiresAt: new Date(NOW.getTime() - 1),
      })
      .mockResolvedValueOnce({
        id: "fresh-dispatch",
        status: DailyDispatchStatus.CLAIMED,
        leaseExpiresAt: new Date(NOW.getTime() + 60_000),
      });
    dailyDispatchRepository.update.mockResolvedValue({ affected: 1 });
    const claimDailyDispatch = (
      service as unknown as {
        claimDailyDispatch(now: Date, time: string): Promise<string | null>;
      }
    ).claimDailyDispatch.bind(service);

    await expect(claimDailyDispatch(NOW, "09:00")).resolves.toBe(
      "stale-dispatch",
    );
    await expect(claimDailyDispatch(NOW, "09:00")).resolves.toBeNull();
  });

  it("does not revive a stale delivery-uncertain claim when a late known SMTP failure arrives", async () => {
    deliveryRepository.update.mockResolvedValueOnce({ affected: 0 });
    const staleClaim = {
      id: "stale-delivery",
      recipientEmail: RECIPIENT.email,
      status: MailDeliveryStatus.PENDING,
      attemptCount: 1,
      claimedAt: NOW,
    } as TenderMailDelivery;

    await (
      service as unknown as {
        persistFailure(delivery: TenderMailDelivery, now: Date): Promise<void>;
      }
    ).persistFailure(staleClaim, NOW);

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      {
        id: staleClaim.id,
        status: MailDeliveryStatus.PENDING,
        claimedAt: NOW,
      },
      expect.objectContaining({
        status: MailDeliveryStatus.RETRY_SCHEDULED,
      }),
    );
    expect(deliveryRepository.save).not.toHaveBeenCalled();
  });

  it("keeps a successful recipient sent when a different recipient's SMTP delivery fails", async () => {
    const failedRecipient = {
      id: "recipient-failed",
      email: "failed@dfkorea.co.kr",
    } as TenderRecipient;
    const successfulRecipient = {
      id: "recipient-success",
      email: "success@dfkorea.co.kr",
    } as TenderRecipient;
    subscriptionRepository.findOne.mockResolvedValue({
      enabled: true,
      deliveryTime: "09:00",
      recipients: [failedRecipient, successfulRecipient],
    });
    let deliveryNumber = 0;
    deliveryRepository.save.mockImplementation(async (value) => ({
      id: `delivery-${++deliveryNumber}`,
      ...value,
    }));
    transport.sendMail.mockImplementation(({ to }) =>
      to === failedRecipient.email
        ? Promise.reject({
            code: "EENVELOPE",
            command: "RCPT TO",
            responseCode: 550,
          })
        : Promise.resolve({ messageId: "smtp-success" }),
    );

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: failedRecipient.email }),
    );
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: successfulRecipient.email }),
    );
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MailDeliveryStatus.PENDING,
      }),
      expect.objectContaining({ status: MailDeliveryStatus.RETRY_SCHEDULED }),
    );
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MailDeliveryStatus.SENT }),
    );
  });

  it("claims a due retry once and leaves its items pending after the second failure", async () => {
    const delivery = {
      id: "delivery-1",
      recipientEmail: RECIPIENT.email,
      status: MailDeliveryStatus.RETRY_SCHEDULED,
      attemptCount: 1,
      nextRetryAt: new Date(NOW.getTime() - 1),
      targetDate: "2026-08-27",
    } as TenderMailDelivery;
    deliveryRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([delivery]);
    deliveryRepository.update.mockResolvedValue({ affected: 1 });
    mailItemRepository.find.mockResolvedValue([
      { id: "item-1", tender: TENDER, lastDeliveryId: delivery.id },
    ]);
    transport.sendMail.mockRejectedValueOnce({
      code: "EENVELOPE",
      command: "RCPT TO",
      responseCode: 550,
    });

    await service.retryDue(NOW);

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      {
        id: delivery.id,
        status: MailDeliveryStatus.RETRY_SCHEDULED,
        nextRetryAt: expect.anything(),
      },
      expect.objectContaining({
        status: MailDeliveryStatus.PENDING,
        attemptCount: 2,
        nextRetryAt: null,
      }),
    );
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: delivery.id,
        status: MailDeliveryStatus.PENDING,
      }),
      expect.objectContaining({
        status: MailDeliveryStatus.FAILED,
        attemptCount: 2,
      }),
    );
    expect(mailItemRepository.update).not.toHaveBeenCalled();
  });

  it("cancels a due retry without SMTP when the shared subscription is disabled", async () => {
    const delivery = {
      id: "delivery-1",
      recipientEmail: RECIPIENT.email,
      status: MailDeliveryStatus.RETRY_SCHEDULED,
      attemptCount: 1,
      nextRetryAt: new Date(NOW.getTime() - 1),
      targetDate: "2026-08-27",
    } as TenderMailDelivery;
    subscriptionRepository.findOne.mockResolvedValue({
      enabled: false,
      recipients: [RECIPIENT],
    });
    deliveryRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([delivery]);
    deliveryRepository.update.mockResolvedValue({ affected: 1 });
    mailItemRepository.find.mockResolvedValue([
      {
        id: "item-1",
        recipientId: RECIPIENT.id,
        tender: TENDER,
        lastDeliveryId: delivery.id,
      },
    ]);

    await service.retryDue(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CANCELLED" }),
    );
    expect(mailItemRepository.update).toHaveBeenCalledWith(
      { lastDeliveryId: delivery.id },
      { lastDeliveryId: null },
    );
  });

  it("cancels a due retry without SMTP when its recipient was removed", async () => {
    const delivery = {
      id: "delivery-removed",
      recipientEmail: RECIPIENT.email,
      status: MailDeliveryStatus.RETRY_SCHEDULED,
      attemptCount: 1,
      nextRetryAt: new Date(NOW.getTime() - 1),
      targetDate: "2026-08-27",
    } as TenderMailDelivery;
    deliveryRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([delivery]);
    deliveryRepository.update.mockResolvedValue({ affected: 1 });
    mailItemRepository.find.mockResolvedValue([
      {
        id: "item-1",
        recipientId: RECIPIENT.id,
        tender: TENDER,
        lastDeliveryId: delivery.id,
      },
    ]);
    recipientRepository.findOne.mockResolvedValue(null);

    await service.retryDue(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CANCELLED" }),
    );
  });

  it("does not send a due retry when another worker already claimed it", async () => {
    const delivery = {
      id: "delivery-claimed",
      recipientEmail: RECIPIENT.email,
      status: MailDeliveryStatus.RETRY_SCHEDULED,
      attemptCount: 1,
      nextRetryAt: new Date(NOW.getTime() - 1),
      targetDate: "2026-08-27",
    } as TenderMailDelivery;
    deliveryRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([delivery]);
    deliveryRepository.update.mockResolvedValue({ affected: 0 });

    await service.retryDue(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(mailItemRepository.find).not.toHaveBeenCalled();
  });

  it("marks a stale SMTP claim and its items delivery-uncertain without retrying", async () => {
    const stale = {
      id: "stale-1",
      recipientEmail: RECIPIENT.email,
      status: MailDeliveryStatus.PENDING,
      attemptCount: 1,
      claimedAt: new Date(NOW.getTime() - 16 * 60_000),
      targetDate: "2026-08-26",
    } as unknown as TenderMailDelivery;
    deliveryRepository.find
      .mockResolvedValueOnce([stale])
      .mockResolvedValueOnce([]);
    deliveryRepository.update.mockResolvedValue({ affected: 1 });
    mailItemRepository.update.mockResolvedValue({ affected: 1 });

    await service.retryDue(NOW);

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      {
        id: stale.id,
        status: MailDeliveryStatus.PENDING,
        claimedAt: expect.anything(),
      },
      expect.objectContaining({
        status: MailDeliveryStatus.DELIVERY_UNCERTAIN,
        uncertainAt: NOW,
      }),
    );
    expect(mailItemRepository.update).toHaveBeenCalledWith(
      { lastDeliveryId: stale.id, status: MailItemStatus.PENDING },
      { status: MailItemStatus.DELIVERY_UNCERTAIN, uncertainAt: NOW },
    );
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it("does not reselect a terminal delivery-uncertain item on a later daily run", async () => {
    mailItemRepository.find.mockResolvedValue([
      {
        recipientId: RECIPIENT.id,
        tenderId: TENDER.id,
        tender: TENDER,
        status: MailItemStatus.DELIVERY_UNCERTAIN,
        lastDelivery: { status: MailDeliveryStatus.DELIVERY_UNCERTAIN },
      },
    ]);

    await service.sendDailyDigest(new Date("2026-08-28T01:00:00.000Z"));

    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it("does not reselect an old sent tender when the same recipient identity is reactivated", async () => {
    mailItemRepository.find.mockResolvedValue([
      {
        recipientId: RECIPIENT.id,
        tenderId: TENDER.id,
        tender: TENDER,
        status: MailItemStatus.SENT,
        lastDelivery: { status: MailDeliveryStatus.SENT },
      },
    ]);

    await service.sendDailyDigest(new Date("2026-08-28T01:00:00.000Z"));

    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it("rejects header injection in SMTP identity without exposing configuration in the delivery error", async () => {
    service = new TenderMailService(
      dataSource,
      subscriptionRepository,
      recipientRepository,
      tenderRepository,
      deliveryRepository,
      mailItemRepository,
      dailyDispatchRepository,
      {
        get: jest.fn(
          (key: string) =>
            ({
              SMTP_HOST: "smtp.worksmobile.com",
              SMTP_USER: "sender@dfkorea.co.kr",
              SMTP_APP_PASSWORD: "not-for-logs",
              SMTP_FROM_NAME: "DF\r\nBcc: victim@example.com",
            })[key],
        ),
      } as never,
      new TenderMailRenderer(),
      transport as never,
    );

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(deliveryRepository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: MailDeliveryStatus.PENDING }),
      expect.objectContaining({
        status: MailDeliveryStatus.RETRY_SCHEDULED,
        errorMessage: "SMTP delivery failed",
      }),
    );
  });

  it("requires SMTP_USER to be one email address before attempting delivery", async () => {
    service = new TenderMailService(
      dataSource,
      subscriptionRepository,
      recipientRepository,
      tenderRepository,
      deliveryRepository,
      mailItemRepository,
      dailyDispatchRepository,
      {
        get: jest.fn(
          (key: string) =>
            ({
              SMTP_HOST: "smtp.worksmobile.com",
              SMTP_USER: "sender@dfkorea.co.kr, other@dfkorea.co.kr",
              SMTP_APP_PASSWORD: "not-for-logs",
              SMTP_FROM_NAME: "DF KOREA",
            })[key],
        ),
      } as never,
      new TenderMailRenderer(),
      transport as never,
    );

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(deliveryRepository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: MailDeliveryStatus.PENDING }),
      expect.objectContaining({ errorMessage: "SMTP delivery failed" }),
    );
  });

  it("records a skipped delivery when an address has no pending notices", async () => {
    tenderRepository.find.mockResolvedValue([]);

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MailDeliveryStatus.SKIPPED }),
    );
  });
});

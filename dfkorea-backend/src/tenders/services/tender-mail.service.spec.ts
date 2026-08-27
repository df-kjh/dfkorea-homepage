import {
  MailDeliveryStatus,
  MailItemStatus,
  ProcurementType,
  TenderRelevance,
  TenderSource,
} from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import { TenderMailDelivery } from "../entities/tender-mail-delivery.entity";
import { TenderMailItem } from "../entities/tender-mail-item.entity";
import { TenderRecipient } from "../entities/tender-recipient.entity";
import { TenderSubscription } from "../entities/tender-subscription.entity";
import { TenderMailRenderer } from "../mail/tender-mail-renderer";
import { TenderMailService } from "./tender-mail.service";

const NOW = new Date("2026-08-27T01:00:00.000Z");
const RECIPIENT = {
  id: "recipient-1",
  email: "sales@dfkorea.co.kr",
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
  relevanceReasons: ["LED"],
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
  let transport: { sendMail: jest.Mock };
  let dataSource: any;
  let service: TenderMailService;

  beforeEach(() => {
    subscriptionRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ enabled: true, recipients: [RECIPIENT] }),
    };
    recipientRepository = { findOne: jest.fn().mockResolvedValue(RECIPIENT) };
    tenderRepository = { find: jest.fn().mockResolvedValue([TENDER]) };
    deliveryRepository = {
      save: jest.fn(async (value) => ({ id: "delivery-1", ...value })),
      find: jest.fn(),
      update: jest.fn(),
    };
    mailItemRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (value) => (Array.isArray(value) ? value : value)),
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
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
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
    transport.sendMail.mockRejectedValueOnce(
      new Error("temporary SMTP failure"),
    );

    await service.sendDailyDigest(NOW);

    expect(deliveryRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: MailDeliveryStatus.RETRY_SCHEDULED,
        attemptCount: 1,
        nextRetryAt: new Date(NOW.getTime() + 10 * 60_000),
      }),
    );
    expect(mailItemRepository.update).not.toHaveBeenCalled();
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
      recipients: [failedRecipient, successfulRecipient],
    });
    let deliveryNumber = 0;
    deliveryRepository.save.mockImplementation(async (value) => ({
      id: `delivery-${++deliveryNumber}`,
      ...value,
    }));
    transport.sendMail.mockImplementation(({ to }) =>
      to === failedRecipient.email
        ? Promise.reject(new Error("one mailbox unavailable"))
        : Promise.resolve({ messageId: "smtp-success" }),
    );

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: failedRecipient.email }),
    );
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: successfulRecipient.email }),
    );
    expect(deliveryRepository.save).toHaveBeenCalledWith(
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
    deliveryRepository.find.mockResolvedValue([delivery]);
    deliveryRepository.update.mockResolvedValue({ affected: 1 });
    mailItemRepository.find.mockResolvedValue([
      { id: "item-1", tender: TENDER, lastDeliveryId: delivery.id },
    ]);
    transport.sendMail.mockRejectedValueOnce(new Error("still unavailable"));

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
    expect(deliveryRepository.save).toHaveBeenCalledWith(
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
    deliveryRepository.find.mockResolvedValue([delivery]);
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
    deliveryRepository.find.mockResolvedValue([delivery]);
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
    deliveryRepository.find.mockResolvedValue([delivery]);
    deliveryRepository.update.mockResolvedValue({ affected: 0 });

    await service.retryDue(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(mailItemRepository.find).not.toHaveBeenCalled();
  });

  it("reclaims a stale first attempt as the one allowed retry after a process restart", async () => {
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

    await service.retryDue(NOW);

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      {
        id: stale.id,
        status: MailDeliveryStatus.PENDING,
        claimedAt: expect.anything(),
      },
      expect.objectContaining({
        status: MailDeliveryStatus.RETRY_SCHEDULED,
        nextRetryAt: NOW,
      }),
    );
  });

  it("rejects header injection in SMTP identity without exposing configuration in the delivery error", async () => {
    service = new TenderMailService(
      dataSource,
      subscriptionRepository,
      recipientRepository,
      tenderRepository,
      deliveryRepository,
      mailItemRepository,
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
    expect(deliveryRepository.save).toHaveBeenLastCalledWith(
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
    expect(deliveryRepository.save).toHaveBeenLastCalledWith(
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

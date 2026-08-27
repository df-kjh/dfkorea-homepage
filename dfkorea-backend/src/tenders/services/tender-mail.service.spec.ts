import { MailDeliveryStatus, MailItemStatus, ProcurementType, TenderRelevance, TenderSource } from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import { TenderMailDelivery } from "../entities/tender-mail-delivery.entity";
import { TenderMailItem } from "../entities/tender-mail-item.entity";
import { TenderRecipient } from "../entities/tender-recipient.entity";
import { TenderSubscription } from "../entities/tender-subscription.entity";
import { TenderMailRenderer } from "../mail/tender-mail-renderer";
import { TenderMailService } from "./tender-mail.service";

const NOW = new Date("2026-08-27T01:00:00.000Z");
const RECIPIENT = { id: "recipient-1", email: "sales@dfkorea.co.kr" } as TenderRecipient;
const TENDER = {
  id: "tender-1", title: "LED 교체", orderingOrganization: "DF", demandOrganization: null,
  source: TenderSource.G2B, sourceNoticeId: "N-1", revision: "00", registeredAt: NOW,
  bidStartedAt: null, bidEndedAt: null, openedAt: null, region: null,
  procurementType: ProcurementType.CONSTRUCTION, contractMethod: null, estimatedAmount: null,
  sourceUrl: "https://example.com", relevance: TenderRelevance.DIRECT, relevanceScore: 100,
  relevanceReasons: ["LED"], rawData: {}, firstCollectedAt: NOW, lastUpdatedAt: NOW,
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
    subscriptionRepository = { findOne: jest.fn().mockResolvedValue({ enabled: true, recipients: [RECIPIENT] }) };
    recipientRepository = {};
    tenderRepository = { find: jest.fn().mockResolvedValue([TENDER]) };
    deliveryRepository = { save: jest.fn(async (value) => ({ id: "delivery-1", ...value })), find: jest.fn(), update: jest.fn() };
    mailItemRepository = { find: jest.fn().mockResolvedValue([]), save: jest.fn(async (value) => Array.isArray(value) ? value : value), update: jest.fn() };
    transport = { sendMail: jest.fn().mockResolvedValue({ messageId: "smtp-1" }) };
    dataSource = {
      createQueryRunner: jest.fn(() => ({ connect: jest.fn(), release: jest.fn(), query: jest.fn().mockResolvedValue([{ locked: true }]) })),
    };
    service = new TenderMailService(
      dataSource,
      subscriptionRepository,
      recipientRepository,
      tenderRepository,
      deliveryRepository,
      mailItemRepository,
      { get: jest.fn((key: string) => ({ SMTP_HOST: "smtp.worksmobile.com", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "sender@dfkorea.co.kr", SMTP_APP_PASSWORD: "secret", SMTP_FROM_NAME: "DF KOREA 입찰정보" }[key])) } as never,
      new TenderMailRenderer(),
      transport as never,
    );
  });

  it("sends each enabled recipient independently and marks only that recipient's items sent", async () => {
    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENT.email }));
    expect(mailItemRepository.update).toHaveBeenCalledWith(
      { lastDeliveryId: "delivery-1" },
      expect.objectContaining({ status: MailItemStatus.SENT, sentAt: NOW }),
    );
    expect(deliveryRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ status: MailDeliveryStatus.SENT, attemptCount: 1 }));
  });

  it("schedules exactly one durable retry ten minutes after a first SMTP failure", async () => {
    transport.sendMail.mockRejectedValueOnce(new Error("temporary SMTP failure"));

    await service.sendDailyDigest(NOW);

    expect(deliveryRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
      status: MailDeliveryStatus.RETRY_SCHEDULED,
      attemptCount: 1,
      nextRetryAt: new Date(NOW.getTime() + 10 * 60_000),
    }));
    expect(mailItemRepository.update).not.toHaveBeenCalled();
  });

  it("claims a due retry once and leaves its items pending after the second failure", async () => {
    const delivery = { id: "delivery-1", recipientEmail: RECIPIENT.email, status: MailDeliveryStatus.RETRY_SCHEDULED, attemptCount: 1, nextRetryAt: new Date(NOW.getTime() - 1), targetDate: "2026-08-27" } as TenderMailDelivery;
    deliveryRepository.find.mockResolvedValue([delivery]);
    deliveryRepository.update.mockResolvedValue({ affected: 1 });
    mailItemRepository.find.mockResolvedValue([{ id: "item-1", tender: TENDER, lastDeliveryId: delivery.id }]);
    transport.sendMail.mockRejectedValueOnce(new Error("still unavailable"));

    await service.retryDue(NOW);

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      { id: delivery.id, status: MailDeliveryStatus.RETRY_SCHEDULED, nextRetryAt: expect.anything() },
      expect.objectContaining({ status: MailDeliveryStatus.PENDING, attemptCount: 2, nextRetryAt: null }),
    );
    expect(deliveryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: MailDeliveryStatus.FAILED, attemptCount: 2 }));
    expect(mailItemRepository.update).not.toHaveBeenCalled();
  });

  it("records a skipped delivery when an address has no pending notices", async () => {
    tenderRepository.find.mockResolvedValue([]);

    await service.sendDailyDigest(NOW);

    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: MailDeliveryStatus.SKIPPED }));
  });
});

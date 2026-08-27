import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { isEmail } from "class-validator";
import { Transporter } from "nodemailer";
import { DataSource, In, LessThanOrEqual, Repository } from "typeorm";
import {
  MailDeliveryStatus,
  MailItemStatus,
  TenderRelevance,
} from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import { TenderMailDelivery } from "../entities/tender-mail-delivery.entity";
import { TenderMailItem } from "../entities/tender-mail-item.entity";
import { TenderRecipient } from "../entities/tender-recipient.entity";
import { TenderSubscription } from "../entities/tender-subscription.entity";
import { TenderMailRenderer } from "../mail/tender-mail-renderer";

export const TENDER_MAIL_TRANSPORT = "TENDER_MAIL_TRANSPORT";
const DAILY_MAIL_LOCK_ID = 824002;
const RETRY_MAIL_LOCK_ID = 824003;
const RETRY_DELAY_MS = 10 * 60 * 1000;
const DELIVERY_LEASE_MS = 15 * 60 * 1000;

interface MailTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ messageId?: string }>;
}
interface DeliveryClaim {
  delivery: TenderMailDelivery;
  tenders: Tender[];
}

@Injectable()
export class TenderMailService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(TenderSubscription)
    private readonly subscriptionRepository: Repository<TenderSubscription>,
    @InjectRepository(TenderRecipient)
    private readonly recipientRepository: Repository<TenderRecipient>,
    @InjectRepository(Tender)
    private readonly tenderRepository: Repository<Tender>,
    @InjectRepository(TenderMailDelivery)
    private readonly deliveryRepository: Repository<TenderMailDelivery>,
    @InjectRepository(TenderMailItem)
    private readonly mailItemRepository: Repository<TenderMailItem>,
    private readonly config: ConfigService,
    private readonly renderer: TenderMailRenderer,
    @Inject(TENDER_MAIL_TRANSPORT)
    private readonly transport: MailTransport | Transporter,
  ) {}

  async sendDailyDigest(now: Date): Promise<void> {
    await this.withAdvisoryLock(DAILY_MAIL_LOCK_ID, async () => {
      const subscription = await this.getActiveSubscription();
      if (!subscription) return;
      await Promise.allSettled(
        (subscription.recipients ?? []).map(async (recipient) => {
          const claim = await this.claimInitialDelivery(recipient, now);
          if (claim) await this.deliver(claim.delivery, claim.tenders, now);
        }),
      );
    });
  }

  async retryDue(now: Date): Promise<void> {
    await this.withAdvisoryLock(RETRY_MAIL_LOCK_ID, async () => {
      await this.recoverStaleClaims(now);
      const dueDeliveries = await this.deliveryRepository.find({
        where: {
          status: MailDeliveryStatus.RETRY_SCHEDULED,
          nextRetryAt: LessThanOrEqual(now),
        },
      });
      for (const delivery of dueDeliveries) {
        const claimed = await this.deliveryRepository.update(
          {
            id: delivery.id,
            status: MailDeliveryStatus.RETRY_SCHEDULED,
            nextRetryAt: LessThanOrEqual(now),
          },
          {
            status: MailDeliveryStatus.PENDING,
            attemptCount: 2,
            nextRetryAt: null,
            claimedAt: now,
          },
        );
        if (claimed.affected !== 1) continue;
        await this.sendRetry(
          {
            ...delivery,
            status: MailDeliveryStatus.PENDING,
            attemptCount: 2,
            nextRetryAt: null,
            claimedAt: now,
          },
          now,
        );
      }
    });
  }

  private async getActiveSubscription(): Promise<TenderSubscription | null> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { singletonKey: "shared" },
      relations: { recipients: true },
    });
    return subscription?.enabled ? subscription : null;
  }

  private async claimInitialDelivery(
    recipient: TenderRecipient,
    now: Date,
  ): Promise<DeliveryClaim | null> {
    return this.dataSource.transaction(async (manager) => {
      const tenderRepository = manager.getRepository(Tender);
      const deliveryRepository = manager.getRepository(TenderMailDelivery);
      const mailItemRepository = manager.getRepository(TenderMailItem);
      const existing = await mailItemRepository.find({
        where: { recipientId: recipient.id },
        relations: { tender: true, lastDelivery: true },
      });
      const knownTenderIds = new Set(existing.map((item) => item.tenderId));
      const tenders = await tenderRepository.find({
        where: {
          relevance: In([TenderRelevance.DIRECT, TenderRelevance.POTENTIAL]),
        },
      });
      const missing = tenders
        .filter((tender) => !knownTenderIds.has(tender.id))
        .map((tender) => ({
          recipientId: recipient.id,
          tenderId: tender.id,
          tender,
          status: MailItemStatus.PENDING,
          lastDeliveryId: null,
          sentAt: null,
        }));
      const inserted =
        missing.length > 0 ? await mailItemRepository.save(missing) : [];
      const eligible = [...existing, ...(inserted as TenderMailItem[])].filter(
        (item) =>
          item.status === MailItemStatus.PENDING &&
          (!item.lastDelivery ||
            item.lastDelivery.status === MailDeliveryStatus.FAILED ||
            item.lastDelivery.status === MailDeliveryStatus.CANCELLED),
      );
      const targetDate = this.toKstDate(now);
      if (eligible.length === 0) {
        await deliveryRepository.save({
          recipientEmail: recipient.email,
          targetDate,
          attemptCount: 0,
          status: MailDeliveryStatus.SKIPPED,
          nextRetryAt: null,
          claimedAt: null,
          smtpMessageId: null,
          sentAt: null,
          failedAt: null,
          errorMessage: null,
        });
        return null;
      }
      // The delivery and every linked item commit together before SMTP starts.
      // A crash is recoverable as an expired lease, with an intentional
      // at-least-once (rather than silently stuck) delivery guarantee.
      const delivery = await deliveryRepository.save({
        recipientEmail: recipient.email,
        targetDate,
        attemptCount: 1,
        status: MailDeliveryStatus.PENDING,
        nextRetryAt: null,
        claimedAt: now,
        smtpMessageId: null,
        sentAt: null,
        failedAt: null,
        errorMessage: null,
      });
      await mailItemRepository.save(
        eligible.map((item) => ({ ...item, lastDeliveryId: delivery.id })),
      );
      return { delivery, tenders: eligible.map((item) => item.tender) };
    });
  }

  private async sendRetry(
    delivery: TenderMailDelivery,
    now: Date,
  ): Promise<void> {
    const items = await this.mailItemRepository.find({
      where: { lastDeliveryId: delivery.id, status: MailItemStatus.PENDING },
      relations: { tender: true },
    });
    if (items.length === 0)
      return this.cancelRetry(
        delivery,
        now,
        "Delivery cancelled because no pending mail items remain",
      );
    if (!(await this.isCurrentEnabledRecipient(delivery, items[0]))) {
      return this.cancelRetry(
        delivery,
        now,
        "Delivery cancelled because its recipient is no longer active",
      );
    }
    await this.deliver(
      delivery,
      items.map((item) => item.tender),
      now,
    );
  }

  private async isCurrentEnabledRecipient(
    delivery: TenderMailDelivery,
    item: TenderMailItem,
  ): Promise<boolean> {
    const subscription = await this.getActiveSubscription();
    if (!subscription) return false;
    const where = {
      id: item.recipientId,
      email: delivery.recipientEmail,
      ...(subscription.id ? { subscriptionId: subscription.id } : {}),
    };
    return Boolean(await this.recipientRepository.findOne({ where }));
  }

  private async cancelRetry(
    delivery: TenderMailDelivery,
    now: Date,
    errorMessage: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const deliveryRepository = manager.getRepository(TenderMailDelivery);
      const mailItemRepository = manager.getRepository(TenderMailItem);
      await deliveryRepository.save({
        ...delivery,
        status: MailDeliveryStatus.CANCELLED,
        nextRetryAt: null,
        claimedAt: null,
        failedAt: now,
        errorMessage,
      });
      // Keep notices pending for a future re-enabled/current recipient.
      await mailItemRepository.update(
        { lastDeliveryId: delivery.id },
        { lastDeliveryId: null },
      );
    });
  }

  private async recoverStaleClaims(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - DELIVERY_LEASE_MS);
    const staleDeliveries = await this.deliveryRepository.find({
      where: {
        status: MailDeliveryStatus.PENDING,
        claimedAt: LessThanOrEqual(staleBefore),
      },
    });
    for (const delivery of staleDeliveries) {
      const firstAttempt = delivery.attemptCount < 2;
      await this.deliveryRepository.update(
        {
          id: delivery.id,
          status: MailDeliveryStatus.PENDING,
          claimedAt: LessThanOrEqual(staleBefore),
        },
        firstAttempt
          ? {
              status: MailDeliveryStatus.RETRY_SCHEDULED,
              nextRetryAt: now,
              claimedAt: null,
              failedAt: delivery.claimedAt ?? now,
              errorMessage:
                "Delivery lease expired before a final result was persisted",
            }
          : {
              status: MailDeliveryStatus.FAILED,
              nextRetryAt: null,
              claimedAt: null,
              failedAt: now,
              errorMessage:
                "Final delivery lease expired before a result was persisted",
            },
      );
    }
  }

  private async deliver(
    delivery: TenderMailDelivery,
    tenders: Tender[],
    now: Date,
  ): Promise<void> {
    let result: { messageId?: string };
    try {
      const configuration = this.getConfiguration();
      const rendered = this.renderer.render(now, tenders);
      result = await this.transport.sendMail({
        from: `"${configuration.fromName.replace(/["\\]/g, "")}" <${configuration.user}>`,
        to: delivery.recipientEmail,
        ...rendered,
      });
    } catch {
      await this.persistFailure(delivery, now);
      return;
    }

    // SMTP acknowledgement is outside a database transaction. Once received,
    // however, item and delivery success state must commit or roll back as one
    // unit; a failed commit leaves the durable lease for at-least-once recovery.
    await this.persistSuccess(delivery, result, now);
  }

  private async persistSuccess(
    delivery: TenderMailDelivery,
    result: { messageId?: string },
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const mailItemRepository = manager.getRepository(TenderMailItem);
      const deliveryRepository = manager.getRepository(TenderMailDelivery);
      await mailItemRepository.update(
        { lastDeliveryId: delivery.id },
        { status: MailItemStatus.SENT, sentAt: now },
      );
      await deliveryRepository.save({
        ...delivery,
        status: MailDeliveryStatus.SENT,
        nextRetryAt: null,
        claimedAt: null,
        smtpMessageId: result.messageId ?? null,
        sentAt: now,
        failedAt: null,
        errorMessage: null,
      });
    });
  }

  private async persistFailure(
    delivery: TenderMailDelivery,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const deliveryRepository = manager.getRepository(TenderMailDelivery);
      if (delivery.attemptCount >= 2) {
        await deliveryRepository.save({
          ...delivery,
          status: MailDeliveryStatus.FAILED,
          attemptCount: 2,
          nextRetryAt: null,
          claimedAt: null,
          failedAt: now,
          errorMessage: "SMTP delivery failed",
        });
        return;
      }
      await deliveryRepository.save({
        ...delivery,
        status: MailDeliveryStatus.RETRY_SCHEDULED,
        attemptCount: 1,
        nextRetryAt: new Date(now.getTime() + RETRY_DELAY_MS),
        claimedAt: null,
        failedAt: now,
        errorMessage: "SMTP delivery failed",
      });
    });
  }

  private getConfiguration(): { user: string; fromName: string } {
    const host = this.config.get<string>("SMTP_HOST");
    const user = this.config.get<string>("SMTP_USER");
    const password = this.config.get<string>("SMTP_APP_PASSWORD");
    const fromName =
      this.config.get<string>("SMTP_FROM_NAME") ?? "DF KOREA 입찰정보";
    if (
      !host ||
      !user ||
      !password ||
      /[\r\n]/.test(host) ||
      /[\r\n]/.test(user) ||
      /[\r\n]/.test(fromName) ||
      !isEmail(user)
    ) {
      throw new Error("NAVER WORKS SMTP configuration is invalid");
    }
    return { user, fromName };
  }

  private async withAdvisoryLock(
    lockId: number,
    work: () => Promise<void>,
  ): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const [result] = await runner.query(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [lockId],
      );
      locked = result?.locked === true;
      if (locked) await work();
    } finally {
      try {
        if (locked)
          await runner.query("SELECT pg_advisory_unlock($1)", [lockId]);
      } finally {
        await runner.release();
      }
    }
  }

  private toKstDate(date: Date): string {
    return new Date(date.getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }
}

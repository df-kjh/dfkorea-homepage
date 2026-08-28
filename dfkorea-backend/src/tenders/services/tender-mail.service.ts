import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { isEmail } from "class-validator";
import { Transporter } from "nodemailer";
import { DataSource, In, LessThanOrEqual, Repository } from "typeorm";
import {
  DailyDispatchStatus,
  MailDeliveryStatus,
  MailItemStatus,
  TenderRelevance,
} from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import { TenderMailDelivery } from "../entities/tender-mail-delivery.entity";
import { TenderMailItem } from "../entities/tender-mail-item.entity";
import { TenderRecipient } from "../entities/tender-recipient.entity";
import { TenderSubscription } from "../entities/tender-subscription.entity";
import { TenderDailyDispatch } from "../entities/tender-daily-dispatch.entity";
import { TenderMailRenderer } from "../mail/tender-mail-renderer";
import {
  classifySmtpTransportError,
  SmtpDeliveryOutcome,
} from "../mail/smtp-delivery-outcome";

export const TENDER_MAIL_TRANSPORT = "TENDER_MAIL_TRANSPORT";
const DAILY_MAIL_LOCK_ID = 824002;
const RETRY_MAIL_LOCK_ID = 824003;
const RETRY_DELAY_MS = 10 * 60 * 1000;
const DELIVERY_LEASE_MS = 15 * 60 * 1000;
const DAILY_DISPATCH_LEASE_MS = 15 * 60 * 1000;

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
    @InjectRepository(TenderDailyDispatch)
    private readonly dailyDispatchRepository: Repository<TenderDailyDispatch>,
    private readonly config: ConfigService,
    private readonly renderer: TenderMailRenderer,
    @Inject(TENDER_MAIL_TRANSPORT)
    private readonly transport: MailTransport | Transporter,
  ) {}

  async sendDailyDigest(now: Date): Promise<void> {
    await this.withAdvisoryLock(DAILY_MAIL_LOCK_ID, async () => {
      const subscription = await this.getActiveSubscription();
      if (!subscription) return;
      if (!this.isDeliveryDue(now, subscription.deliveryTime)) return;
      const dispatchId = await this.claimDailyDispatch(
        now,
        subscription.deliveryTime,
      );
      if (!dispatchId) return;
      const results = await Promise.allSettled(
        (subscription.recipients ?? []).map(async (recipient) => {
          const claim = await this.claimInitialDelivery(recipient, now);
          if (!claim) return;
          try {
            await this.deliver(claim.delivery, claim.tenders, now);
          } catch {
            // A durable PENDING delivery already exists. Its lease recovery will
            // conservatively resolve an unknown post-claim persistence outcome.
          }
        }),
      );
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (rejected) {
        try {
          await this.dailyDispatchRepository.update(dispatchId, {
            status: DailyDispatchStatus.CLAIMED,
            lastError: "Recipient delivery claim failed before durable state",
          });
        } catch {
          // The claim row is already durable and remains CLAIMED. Preserve the
          // primary recipient-claim error even if its audit update also fails.
        }
        throw rejected.reason;
      }
      await this.dailyDispatchRepository.update(dispatchId, {
        status: DailyDispatchStatus.COMPLETED,
        completedAt: now,
        lastError: null,
      });
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
    if (!subscription?.enabled) return null;
    subscription.recipients = (subscription.recipients ?? []).filter(
      (recipient) => recipient.isActive !== false,
    );
    return subscription;
  }

  private isDeliveryDue(now: Date, deliveryTime: string): boolean {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "00";
    return `${value("hour")}:${value("minute")}` >= deliveryTime;
  }

  private async claimDailyDispatch(
    now: Date,
    deliveryTime: string,
  ): Promise<string | null> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TenderDailyDispatch);
      const result = await repository
        .createQueryBuilder()
        .insert()
        .values({
          businessDate: this.toKstDate(now),
          deliveryTime,
          status: DailyDispatchStatus.CLAIMED,
          claimedAt: now,
          leaseExpiresAt: new Date(now.getTime() + DAILY_DISPATCH_LEASE_MS),
          lastError: null,
          completedAt: null,
        })
        .orIgnore()
        .returning("id")
        .execute();
      const row = Array.isArray(result.raw) ? result.raw[0] : undefined;
      if (typeof row?.id === "string") return row.id;

      const existing = await repository.findOne({
        where: { businessDate: this.toKstDate(now) },
      });
      if (
        !existing ||
        existing.status !== DailyDispatchStatus.CLAIMED ||
        existing.leaseExpiresAt > now
      ) {
        return null;
      }
      const reclaimed = await repository.update(
        {
          id: existing.id,
          status: DailyDispatchStatus.CLAIMED,
          leaseExpiresAt: LessThanOrEqual(now),
        },
        {
          deliveryTime,
          claimedAt: now,
          leaseExpiresAt: new Date(now.getTime() + DAILY_DISPATCH_LEASE_MS),
          lastError: null,
          completedAt: null,
        },
      );
      return reclaimed.affected === 1 ? existing.id : null;
    });
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
          uncertainAt: null,
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
          uncertainAt: null,
          errorMessage: null,
        });
        return null;
      }
      // The delivery and every linked item commit together before SMTP starts.
      // If the SMTP outcome cannot later be proven, the expired lease becomes
      // terminal DELIVERY_UNCERTAIN rather than risking a duplicate resend.
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
        uncertainAt: null,
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
      isActive: true,
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
        uncertainAt: null,
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
      await this.dataSource.transaction(async (manager) => {
        const deliveryRepository = manager.getRepository(TenderMailDelivery);
        const mailItemRepository = manager.getRepository(TenderMailItem);
        const transitioned = await deliveryRepository.update(
          {
            id: delivery.id,
            status: MailDeliveryStatus.PENDING,
            claimedAt: LessThanOrEqual(staleBefore),
          },
          {
            status: MailDeliveryStatus.DELIVERY_UNCERTAIN,
            nextRetryAt: null,
            claimedAt: null,
            failedAt: null,
            uncertainAt: now,
            errorMessage:
              "SMTP outcome is uncertain because the delivery lease expired",
          },
        );
        if (transitioned.affected !== 1) return;
        await mailItemRepository.update(
          {
            lastDeliveryId: delivery.id,
            status: MailItemStatus.PENDING,
          },
          {
            status: MailItemStatus.DELIVERY_UNCERTAIN,
            uncertainAt: now,
          },
        );
      });
    }
  }

  private async deliver(
    delivery: TenderMailDelivery,
    tenders: Tender[],
    now: Date,
  ): Promise<void> {
    let message: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    try {
      const configuration = this.getConfiguration();
      const rendered = this.renderer.render(now, tenders);
      message = {
        from: `"${configuration.fromName.replace(/["\\]/g, "")}" <${configuration.user}>`,
        to: delivery.recipientEmail,
        ...rendered,
      };
    } catch {
      await this.persistFailure(delivery, now);
      return;
    }

    let result: { messageId?: string };
    try {
      result = await this.transport.sendMail(message);
    } catch (error: unknown) {
      if (
        classifySmtpTransportError(error) ===
        SmtpDeliveryOutcome.CONFIRMED_FAILURE
      ) {
        await this.persistFailure(delivery, now);
      } else {
        await this.persistUncertain(delivery, now);
      }
      return;
    }

    // SMTP acknowledgement is outside a database transaction. Once received,
    // however, item and delivery success state must commit or roll back as one
    // unit; a failed commit leaves the durable lease to become terminal
    // DELIVERY_UNCERTAIN, deliberately preferring possible loss to duplication.
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
        { status: MailItemStatus.SENT, sentAt: now, uncertainAt: null },
      );
      await deliveryRepository.save({
        ...delivery,
        status: MailDeliveryStatus.SENT,
        nextRetryAt: null,
        claimedAt: null,
        smtpMessageId: result.messageId ?? null,
        sentAt: now,
        failedAt: null,
        uncertainAt: null,
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
      const where = {
        id: delivery.id,
        status: MailDeliveryStatus.PENDING,
        claimedAt: delivery.claimedAt,
      };
      if (delivery.attemptCount >= 2) {
        await deliveryRepository.update(where, {
          status: MailDeliveryStatus.FAILED,
          attemptCount: 2,
          nextRetryAt: null,
          claimedAt: null,
          failedAt: now,
          uncertainAt: null,
          errorMessage: "SMTP delivery failed",
        });
        return;
      }
      await deliveryRepository.update(where, {
        status: MailDeliveryStatus.RETRY_SCHEDULED,
        attemptCount: 1,
        nextRetryAt: new Date(now.getTime() + RETRY_DELAY_MS),
        claimedAt: null,
        failedAt: now,
        uncertainAt: null,
        errorMessage: "SMTP delivery failed",
      });
    });
  }

  private async persistUncertain(
    delivery: TenderMailDelivery,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const deliveryRepository = manager.getRepository(TenderMailDelivery);
      const mailItemRepository = manager.getRepository(TenderMailItem);
      const transitioned = await deliveryRepository.update(
        {
          id: delivery.id,
          status: MailDeliveryStatus.PENDING,
          claimedAt: delivery.claimedAt,
        },
        {
          status: MailDeliveryStatus.DELIVERY_UNCERTAIN,
          nextRetryAt: null,
          claimedAt: null,
          failedAt: null,
          uncertainAt: now,
          errorMessage: "SMTP delivery outcome is uncertain",
        },
      );
      if (transitioned.affected !== 1) return;
      await mailItemRepository.update(
        {
          lastDeliveryId: delivery.id,
          status: MailItemStatus.PENDING,
        },
        {
          status: MailItemStatus.DELIVERY_UNCERTAIN,
          uncertainAt: now,
        },
      );
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

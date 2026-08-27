import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Transporter } from "nodemailer";
import { DataSource, In, LessThanOrEqual, Repository } from "typeorm";
import { MailDeliveryStatus, MailItemStatus, TenderRelevance } from "../domain/tender.enums";
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

interface MailTransport {
  sendMail(message: { from: string; to: string; subject: string; html: string; text: string }): Promise<{ messageId?: string }>;
}

@Injectable()
export class TenderMailService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(TenderSubscription) private readonly subscriptionRepository: Repository<TenderSubscription>,
    @InjectRepository(TenderRecipient) private readonly recipientRepository: Repository<TenderRecipient>,
    @InjectRepository(Tender) private readonly tenderRepository: Repository<Tender>,
    @InjectRepository(TenderMailDelivery) private readonly deliveryRepository: Repository<TenderMailDelivery>,
    @InjectRepository(TenderMailItem) private readonly mailItemRepository: Repository<TenderMailItem>,
    private readonly config: ConfigService,
    private readonly renderer: TenderMailRenderer,
    @Inject(TENDER_MAIL_TRANSPORT) private readonly transport: MailTransport | Transporter,
  ) {}

  async sendDailyDigest(now: Date): Promise<void> {
    await this.withAdvisoryLock(DAILY_MAIL_LOCK_ID, async () => {
      const subscription = await this.subscriptionRepository.findOne({
        where: { singletonKey: "shared" },
        relations: { recipients: true },
      });
      if (!subscription?.enabled) return;

      await Promise.allSettled(
        (subscription.recipients ?? []).map((recipient) => this.sendInitialRecipient(recipient, now)),
      );
    });
  }

  async retryDue(now: Date): Promise<void> {
    await this.withAdvisoryLock(RETRY_MAIL_LOCK_ID, async () => {
      const dueDeliveries = await this.deliveryRepository.find({
        where: { status: MailDeliveryStatus.RETRY_SCHEDULED, nextRetryAt: LessThanOrEqual(now) },
      });
      for (const delivery of dueDeliveries) {
        const claimed = await this.deliveryRepository.update(
          { id: delivery.id, status: MailDeliveryStatus.RETRY_SCHEDULED, nextRetryAt: LessThanOrEqual(now) },
          { status: MailDeliveryStatus.PENDING, attemptCount: 2, nextRetryAt: null },
        );
        if (claimed.affected !== 1) continue;
        await this.sendRetry(delivery, now);
      }
    });
  }

  private async sendInitialRecipient(recipient: TenderRecipient, now: Date): Promise<void> {
    const items = await this.preparePendingItems(recipient.id);
    const eligible = items.filter((item) =>
      item.status === MailItemStatus.PENDING && (!item.lastDelivery || item.lastDelivery.status === MailDeliveryStatus.FAILED),
    );
    const targetDate = this.toKstDate(now);
    if (eligible.length === 0) {
      await this.deliveryRepository.save({
        recipientEmail: recipient.email, targetDate, attemptCount: 0, status: MailDeliveryStatus.SKIPPED,
        nextRetryAt: null, smtpMessageId: null, sentAt: null, failedAt: null, errorMessage: null,
      });
      return;
    }

    const delivery = await this.deliveryRepository.save({
      recipientEmail: recipient.email, targetDate, attemptCount: 1, status: MailDeliveryStatus.PENDING,
      nextRetryAt: null, smtpMessageId: null, sentAt: null, failedAt: null, errorMessage: null,
    });
    await this.mailItemRepository.save(eligible.map((item) => ({ ...item, lastDeliveryId: delivery.id })));
    await this.deliver(delivery, eligible.map((item) => item.tender), now);
  }

  private async sendRetry(delivery: TenderMailDelivery, now: Date): Promise<void> {
    const items = await this.mailItemRepository.find({
      where: { lastDeliveryId: delivery.id, status: MailItemStatus.PENDING },
      relations: { tender: true },
    });
    if (items.length === 0) {
      await this.deliveryRepository.save({ ...delivery, status: MailDeliveryStatus.FAILED, attemptCount: 2, nextRetryAt: null, failedAt: now, errorMessage: "No pending mail items remain" });
      return;
    }
    await this.deliver({ ...delivery, attemptCount: 2 }, items.map((item) => item.tender), now);
  }

  private async preparePendingItems(recipientId: string): Promise<TenderMailItem[]> {
    const existing = await this.mailItemRepository.find({
      where: { recipientId },
      relations: { tender: true, lastDelivery: true },
    });
    const knownTenderIds = new Set(existing.map((item) => item.tenderId));
    const tenders = await this.tenderRepository.find({
      where: { relevance: In([TenderRelevance.DIRECT, TenderRelevance.POTENTIAL]) },
    });
    const missing = tenders
      .filter((tender) => !knownTenderIds.has(tender.id))
      .map((tender) => ({ recipientId, tenderId: tender.id, tender, status: MailItemStatus.PENDING, lastDeliveryId: null, sentAt: null }));
    const inserted = missing.length > 0 ? await this.mailItemRepository.save(missing) : [];
    return [...existing, ...(inserted as TenderMailItem[])];
  }

  private async deliver(delivery: TenderMailDelivery, tenders: Tender[], now: Date): Promise<void> {
    try {
      const configuration = this.getConfiguration();
      const rendered = this.renderer.render(now, tenders);
      const result = await this.transport.sendMail({
        from: `"${configuration.fromName.replace(/["\\]/g, "")}" <${configuration.user}>`,
        to: delivery.recipientEmail,
        ...rendered,
      });
      await this.mailItemRepository.update(
        { lastDeliveryId: delivery.id },
        { status: MailItemStatus.SENT, sentAt: now },
      );
      await this.deliveryRepository.save({
        ...delivery, status: MailDeliveryStatus.SENT, nextRetryAt: null,
        smtpMessageId: result.messageId ?? null, sentAt: now, failedAt: null, errorMessage: null,
      });
    } catch {
      if (delivery.attemptCount >= 2) {
        await this.deliveryRepository.save({
          ...delivery, status: MailDeliveryStatus.FAILED, attemptCount: 2, nextRetryAt: null,
          failedAt: now, errorMessage: "SMTP delivery failed",
        });
        return;
      }
      await this.deliveryRepository.save({
        ...delivery, status: MailDeliveryStatus.RETRY_SCHEDULED, attemptCount: 1,
        nextRetryAt: new Date(now.getTime() + RETRY_DELAY_MS), failedAt: now,
        errorMessage: "SMTP delivery failed",
      });
    }
  }

  private getConfiguration(): { user: string; fromName: string } {
    const host = this.config.get<string>("SMTP_HOST");
    const user = this.config.get<string>("SMTP_USER");
    const password = this.config.get<string>("SMTP_APP_PASSWORD");
    if (!host || !user || !password) {
      throw new Error("NAVER WORKS SMTP configuration is required before sending tender mail");
    }
    return { user, fromName: this.config.get<string>("SMTP_FROM_NAME") ?? "DF KOREA 입찰정보" };
  }

  private async withAdvisoryLock(lockId: number, work: () => Promise<void>): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const [result] = await runner.query("SELECT pg_try_advisory_lock($1) AS locked", [lockId]);
      locked = result?.locked === true;
      if (locked) await work();
    } finally {
      if (locked) await runner.query("SELECT pg_advisory_unlock($1)", [lockId]);
      await runner.release();
    }
  }

  private toKstDate(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }
}

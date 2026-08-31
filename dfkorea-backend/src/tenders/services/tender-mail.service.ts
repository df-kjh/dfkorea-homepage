import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, LessThanOrEqual, Repository } from "typeorm";
import {
  DailyDispatchStatus,
  MailDeliveryStatus,
  MailItemStatus,
  TenderRelevance,
} from "../domain/tender.enums";
import {
  ELIGIBLE_TENDER_OPPORTUNITY_TYPES,
  isEligibleTenderOpportunityType,
} from "../domain/tender-opportunity-eligibility";
import { Tender } from "../entities/tender.entity";
import { TenderMailDelivery } from "../entities/tender-mail-delivery.entity";
import { TenderMailItem } from "../entities/tender-mail-item.entity";
import { TenderRecipient } from "../entities/tender-recipient.entity";
import { TenderSubscription } from "../entities/tender-subscription.entity";
import { TenderDailyDispatch } from "../entities/tender-daily-dispatch.entity";
import { TenderMailRenderer } from "../mail/tender-mail-renderer";
import {
  classifyMailDeliveryError,
  MailDeliveryOutcome,
} from "../mail/mail-delivery-outcome";

export const TENDER_MAIL_TRANSPORT = "TENDER_MAIL_TRANSPORT";
const DAILY_MAIL_LOCK_ID = 824002;
const RETRY_MAIL_LOCK_ID = 824003;
const RETRY_DELAY_MS = 10 * 60 * 1000;
const DELIVERY_LEASE_MS = 15 * 60 * 1000;
const DAILY_DISPATCH_LEASE_MS = 15 * 60 * 1000;
const MAIL_PROVIDER_CONCURRENCY = 4;

interface MailTransport {
  sendMail(message: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ providerMessageId?: string | null }>;
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
    private readonly renderer: TenderMailRenderer,
    @Inject(TENDER_MAIL_TRANSPORT)
    private readonly transport: MailTransport,
  ) {}

  async sendDailyDigest(now: Date): Promise<void> {
    await this.withAdvisoryLock(DAILY_MAIL_LOCK_ID, async () => {
      const subscription = await this.getActiveSubscription();
      if (!subscription) return;
      if (!this.isDeliveryDue(now, subscription.deliveryTime)) return;
      // A changed delivery-time slot may intentionally reselect a prior
      // uncertain item. Resolve expired provider leases first so the new slot
      // cannot become durably SKIPPED immediately before retry recovery marks
      // that item uncertain.
      await this.recoverStaleClaims(now);
      const dispatchId = await this.claimDailyDispatch(
        now,
        subscription.deliveryTime,
      );
      if (!dispatchId) return;
      const results: PromiseSettledResult<void>[] = [];
      const recipients = subscription.recipients ?? [];
      for (
        let offset = 0;
        offset < recipients.length;
        offset += MAIL_PROVIDER_CONCURRENCY
      ) {
        const batch = recipients.slice(
          offset,
          offset + MAIL_PROVIDER_CONCURRENCY,
        );
        results.push(
          ...(await Promise.allSettled(
            batch.map(async (recipient) => {
              const claim = await this.claimInitialDelivery(
                dispatchId,
                recipient,
                now,
              );
              if (!claim) return;
              try {
                await this.deliver(claim.delivery, claim.tenders, now);
              } catch {
                // A durable PENDING delivery already exists. Its lease recovery
                // conservatively resolves an unknown persistence outcome.
              }
            }),
          )),
        );
      }
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
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
        where: {
          businessDate: this.toKstDate(now),
          deliveryTime,
        },
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
    dailyDispatchId: string,
    recipient: TenderRecipient,
    now: Date,
  ): Promise<DeliveryClaim | null> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tenderRepository = manager.getRepository(Tender);
        const deliveryRepository = manager.getRepository(TenderMailDelivery);
        const mailItemRepository = manager.getRepository(TenderMailItem);
        const durableOutcome = await deliveryRepository.findOne({
          where: { dailyDispatchId, recipientId: recipient.id },
        });
        if (durableOutcome) return null;
        const existing = await mailItemRepository.find({
          where: { recipientId: recipient.id },
          relations: { tender: true, lastDelivery: true },
        });
        const knownTenderIds = new Set(existing.map((item) => item.tenderId));
        const tenders = await tenderRepository.find({
          where: {
            relevance: In([TenderRelevance.DIRECT, TenderRelevance.POTENTIAL]),
            opportunityType: In(ELIGIBLE_TENDER_OPPORTUNITY_TYPES),
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
        const eligible = [
          ...existing,
          ...(inserted as TenderMailItem[]),
        ].filter(
          (item) =>
            isEligibleTenderOpportunityType(item.tender.opportunityType) &&
            (item.status === MailItemStatus.DELIVERY_UNCERTAIN ||
              (item.status === MailItemStatus.PENDING &&
              (!item.lastDelivery ||
                item.lastDelivery.status === MailDeliveryStatus.FAILED ||
                item.lastDelivery.status === MailDeliveryStatus.CANCELLED))),
        );
        const targetDate = this.toKstDate(now);
        if (eligible.length === 0) {
          await deliveryRepository.save({
            dailyDispatchId,
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            targetDate,
            attemptCount: 0,
            status: MailDeliveryStatus.SKIPPED,
            nextRetryAt: null,
            claimedAt: null,
            providerMessageId: null,
            sentAt: null,
            failedAt: null,
            uncertainAt: null,
            errorMessage: null,
          });
          return null;
        }
        // The delivery and every linked item commit before the provider request.
        // If its outcome cannot later be proven, the expired lease becomes
        // terminal for this slot. A later date or explicitly changed time slot
        // may reselect it under the user-approved no-daily-limit policy.
        const delivery = await deliveryRepository.save({
          dailyDispatchId,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          targetDate,
          attemptCount: 1,
          status: MailDeliveryStatus.PENDING,
          nextRetryAt: null,
          claimedAt: now,
          providerMessageId: null,
          sentAt: null,
          failedAt: null,
          uncertainAt: null,
          errorMessage: null,
        });
        await mailItemRepository.save(
          eligible.map((item) => ({
            ...item,
            status: MailItemStatus.PENDING,
            uncertainAt: null,
            lastDeliveryId: delivery.id,
          })),
        );
        return { delivery, tenders: eligible.map((item) => item.tender) };
      });
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) throw error;
      const existing = await this.deliveryRepository.findOne({
        where: { dailyDispatchId, recipientId: recipient.id },
      });
      if (existing) return null;
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const candidate = error as {
      code?: unknown;
      driverError?: { code?: unknown };
    };
    return (
      candidate.code === "23505" || candidate.driverError?.code === "23505"
    );
  }

  private async sendRetry(
    delivery: TenderMailDelivery,
    now: Date,
  ): Promise<void> {
    const items = await this.mailItemRepository.find({
      where: { lastDeliveryId: delivery.id, status: MailItemStatus.PENDING },
      relations: { tender: true },
    });
    const eligibleItems = items.filter((item) =>
      isEligibleTenderOpportunityType(item.tender.opportunityType),
    );
    const excludedMailItemIds = items
      .filter((item) => !isEligibleTenderOpportunityType(item.tender.opportunityType))
      .map((item) => item.id);
    if (eligibleItems.length === 0)
      return this.cancelRetry(
        delivery,
        now,
        "Delivery cancelled because no pending mail items remain",
      );
    if (!(await this.isCurrentEnabledRecipient(delivery, eligibleItems[0]))) {
      return this.cancelRetry(
        delivery,
        now,
        "Delivery cancelled because its recipient is no longer active",
      );
    }
    await this.deliver(
      delivery,
      eligibleItems.map((item) => item.tender),
      now,
      eligibleItems.map((item) => item.id),
      excludedMailItemIds,
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
              "Mail provider outcome is uncertain because the delivery lease expired",
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
    deliveredMailItemIds?: string[],
    excludedMailItemIds?: string[],
  ): Promise<void> {
    let message: {
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    try {
      const rendered = this.renderer.render(now, tenders);
      message = {
        to: delivery.recipientEmail,
        ...rendered,
      };
    } catch {
      await this.persistFailure(delivery, now);
      return;
    }

    let result: { providerMessageId?: string | null };
    try {
      result = await this.transport.sendMail(message);
    } catch (error: unknown) {
      const outcome = classifyMailDeliveryError(error);
      if (outcome === MailDeliveryOutcome.RETRYABLE_REJECTION) {
        await this.persistFailure(delivery, now);
      } else if (outcome === MailDeliveryOutcome.PERMANENT_REJECTION) {
        await this.persistPermanentFailure(delivery, now);
      } else {
        await this.persistUncertain(delivery, now);
      }
      return;
    }

    // Provider acknowledgement is outside a database transaction. Once received,
    // however, item and delivery success state must commit or roll back as one
    // unit; a failed commit leaves the durable lease to become terminal
    // DELIVERY_UNCERTAIN, deliberately preferring possible loss to duplication.
    await this.persistSuccess(
      delivery,
      result,
      now,
      deliveredMailItemIds,
      excludedMailItemIds,
    );
  }

  private async persistSuccess(
    delivery: TenderMailDelivery,
    result: { providerMessageId?: string | null },
    now: Date,
    deliveredMailItemIds?: string[],
    excludedMailItemIds?: string[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const mailItemRepository = manager.getRepository(TenderMailItem);
      const deliveryRepository = manager.getRepository(TenderMailDelivery);
      await mailItemRepository.update(
        deliveredMailItemIds
          ? { id: In(deliveredMailItemIds), lastDeliveryId: delivery.id }
          : { lastDeliveryId: delivery.id },
        { status: MailItemStatus.SENT, sentAt: now, uncertainAt: null },
      );
      if (excludedMailItemIds && excludedMailItemIds.length > 0) {
        // These items were intentionally omitted from the acknowledged
        // provider payload. Clear the completed delivery link so a later
        // eligible reclassification can create a fresh, recoverable delivery.
        await mailItemRepository.update(
          { id: In(excludedMailItemIds), lastDeliveryId: delivery.id },
          { lastDeliveryId: null },
        );
      }
      await deliveryRepository.save({
        ...delivery,
        status: MailDeliveryStatus.SENT,
        nextRetryAt: null,
        claimedAt: null,
        providerMessageId: result.providerMessageId ?? null,
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
          errorMessage: "Mail provider delivery failed after one retry",
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
        errorMessage: "Mail provider delivery temporarily rejected",
      });
    });
  }

  private async persistPermanentFailure(
    delivery: TenderMailDelivery,
    now: Date,
  ): Promise<void> {
    await this.deliveryRepository.update(
      {
        id: delivery.id,
        status: MailDeliveryStatus.PENDING,
        claimedAt: delivery.claimedAt,
      },
      {
        status: MailDeliveryStatus.FAILED,
        nextRetryAt: null,
        claimedAt: null,
        failedAt: now,
        uncertainAt: null,
        errorMessage: "Mail provider permanently rejected delivery",
      },
    );
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
          errorMessage: "Mail provider delivery outcome is uncertain",
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

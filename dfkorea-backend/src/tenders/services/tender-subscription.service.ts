import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager } from "typeorm";
import { UpdateTenderSubscriptionDto } from "../dto/update-tender-subscription.dto";
import { TenderRecipient } from "../entities/tender-recipient.entity";
import { TenderSubscription } from "../entities/tender-subscription.entity";

const SHARED_SUBSCRIPTION_KEY = "shared";

export interface TenderSubscriptionDto {
  enabled: boolean;
  deliveryTime: string;
  recipients: string[];
}

@Injectable()
export class TenderSubscriptionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getOrCreate(): Promise<TenderSubscriptionDto> {
    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.getOrCreateEntity(manager);
      return this.toDto(subscription);
    });
  }

  async update(
    updateDto: UpdateTenderSubscriptionDto,
  ): Promise<TenderSubscriptionDto> {
    const recipients = this.normalizeRecipients(updateDto.recipients);
    if (updateDto.enabled && recipients.length === 0) {
      throw new BadRequestException(
        "recipients are required while delivery is enabled",
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.getOrCreateEntity(manager);
      const subscriptionRepository = manager.getRepository(TenderSubscription);
      const recipientRepository = manager.getRepository(TenderRecipient);

      await subscriptionRepository.save({
        ...subscription,
        enabled: updateDto.enabled,
        deliveryTime: updateDto.deliveryTime,
      });
      const existingByEmail = new Map(
        (subscription.recipients ?? []).map((recipient) => [
          recipient.email.trim().toLowerCase(),
          recipient,
        ]),
      );
      const desiredEmails = new Set(recipients);
      const removedIds = [...existingByEmail.entries()]
        .filter(([email]) => !desiredEmails.has(email))
        .map(([, recipient]) => recipient.id);
      const newRecipients = recipients
        .filter((email) => !existingByEmail.has(email))
        .map((email) => ({ subscriptionId: subscription.id, email }));

      // Retaining unchanged rows is essential: mail items reference recipient
      // IDs, and deleting/recreating them would erase send history on a mere
      // delivery-time change.
      if (removedIds.length > 0) {
        await recipientRepository.delete(removedIds);
      }
      if (newRecipients.length > 0) {
        await recipientRepository.save(newRecipients);
      }

      return {
        enabled: updateDto.enabled,
        deliveryTime: updateDto.deliveryTime,
        recipients,
      };
    });
  }

  private async getOrCreateEntity(
    manager: EntityManager,
  ): Promise<TenderSubscription> {
    const subscriptionRepository = manager.getRepository(TenderSubscription);

    // The unique singleton key makes this safe when two admin requests first
    // arrive at once. PostgreSQL ignores the losing insert without aborting
    // the transaction, then both requests read the same shared row.
    await subscriptionRepository
      .createQueryBuilder()
      .insert()
      .values({ singletonKey: SHARED_SUBSCRIPTION_KEY })
      .orIgnore()
      .execute();

    const subscription = await subscriptionRepository.findOne({
      where: { singletonKey: SHARED_SUBSCRIPTION_KEY },
      relations: { recipients: true },
    });
    if (!subscription) {
      throw new InternalServerErrorException(
        "Unable to initialize tender subscription",
      );
    }
    return subscription;
  }

  private normalizeRecipients(recipients: string[]): string[] {
    return [
      ...new Set(recipients.map((email) => email.trim().toLowerCase())),
    ].sort((left, right) => left.localeCompare(right));
  }

  private toDto(subscription: TenderSubscription): TenderSubscriptionDto {
    return {
      enabled: subscription.enabled,
      deliveryTime: subscription.deliveryTime,
      recipients: this.normalizeRecipients(
        (subscription.recipients ?? []).map((recipient) => recipient.email),
      ),
    };
  }
}

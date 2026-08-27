import { BadRequestException } from "@nestjs/common";
import { TenderSubscription } from "../entities/tender-subscription.entity";
import { TenderSubscriptionService } from "./tender-subscription.service";

const SUBSCRIPTION_ID = "00000000-0000-4000-8000-000000000001";

const createInsertBuilder = () => {
  const builder = {
    insert: jest.fn(),
    values: jest.fn(),
    orIgnore: jest.fn(),
    execute: jest.fn(),
  };
  Object.values(builder).forEach((method) => {
    (method as jest.Mock).mockReturnValue(builder);
  });
  return builder;
};

describe("TenderSubscriptionService", () => {
  let subscriptionRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let recipientRepository: { delete: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: TenderSubscriptionService;

  beforeEach(() => {
    subscriptionRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    recipientRepository = { delete: jest.fn(), save: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === TenderSubscription
          ? subscriptionRepository
          : recipientRepository,
      ),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new TenderSubscriptionService(dataSource as never);
  });

  it("retains matching recipient rows when only the shared delivery time changes", async () => {
    const insertBuilder = createInsertBuilder();
    subscriptionRepository.createQueryBuilder.mockReturnValue(insertBuilder);
    subscriptionRepository.findOne.mockResolvedValue({
      id: SUBSCRIPTION_ID,
      enabled: false,
      deliveryTime: "09:00",
      recipients: [
        { id: "recipient-history-id", email: "sales@dfkorea.co.kr" },
      ],
    });
    subscriptionRepository.save.mockResolvedValue(undefined);
    recipientRepository.delete.mockResolvedValue(undefined);
    recipientRepository.save.mockResolvedValue(undefined);

    await expect(
      service.update({
        enabled: true,
        deliveryTime: "09:00",
        recipients: [" Sales@DFKorea.co.kr "],
      }),
    ).resolves.toEqual({
      enabled: true,
      deliveryTime: "09:00",
      recipients: ["sales@dfkorea.co.kr"],
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(subscriptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SUBSCRIPTION_ID,
        enabled: true,
        deliveryTime: "09:00",
      }),
    );
    expect(recipientRepository.delete).not.toHaveBeenCalled();
    expect(recipientRepository.save).not.toHaveBeenCalled();
    expect(subscriptionRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { singletonKey: "shared" },
      lock: { mode: "pessimistic_write" },
    });
    expect(subscriptionRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { singletonKey: "shared" },
      relations: { recipients: true },
    });
  });

  it("adds and removes only changed addresses so retained recipient history survives", async () => {
    const insertBuilder = createInsertBuilder();
    subscriptionRepository.createQueryBuilder.mockReturnValue(insertBuilder);
    subscriptionRepository.findOne.mockResolvedValue({
      id: SUBSCRIPTION_ID,
      enabled: true,
      deliveryTime: "09:00",
      recipients: [
        { id: "retained-id", email: "sales@dfkorea.co.kr" },
        { id: "removed-id", email: "old@dfkorea.co.kr" },
      ],
    });

    await service.update({
      enabled: true,
      deliveryTime: "09:00",
      recipients: ["sales@dfkorea.co.kr", "new@dfkorea.co.kr"],
    });

    expect(recipientRepository.delete).toHaveBeenCalledWith(["removed-id"]);
    expect(recipientRepository.save).toHaveBeenCalledWith([
      { subscriptionId: SUBSCRIPTION_ID, email: "new@dfkorea.co.kr" },
    ]);
  });

  it("creates missing shared settings with an idempotent singleton insert", async () => {
    const insertBuilder = createInsertBuilder();
    subscriptionRepository.createQueryBuilder.mockReturnValue(insertBuilder);
    subscriptionRepository.findOne.mockResolvedValue({
      id: SUBSCRIPTION_ID,
      enabled: false,
      deliveryTime: "09:00",
      recipients: [{ email: "z@dfkorea.co.kr" }, { email: "a@dfkorea.co.kr" }],
    });

    await expect(service.getOrCreate()).resolves.toEqual({
      enabled: false,
      deliveryTime: "09:00",
      recipients: ["a@dfkorea.co.kr", "z@dfkorea.co.kr"],
    });

    expect(insertBuilder.values).toHaveBeenCalledWith({
      singletonKey: "shared",
    });
    expect(insertBuilder.orIgnore).toHaveBeenCalledTimes(1);
    expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
      where: { singletonKey: "shared" },
      relations: { recipients: true },
    });
  });

  it("rejects enabling email delivery without recipients before opening a transaction", async () => {
    await expect(
      service.update({ enabled: true, deliveryTime: "09:00", recipients: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

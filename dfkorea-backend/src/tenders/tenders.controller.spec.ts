import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { NotFoundException } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TenderSource } from "./domain/tender.enums";
import { TendersController } from "./tenders.controller";

describe("TendersController", () => {
  const query = {
    getCalendar: jest.fn(),
    getTenders: jest.fn(),
    getTender: jest.fn(),
  };
  const subscription = {
    getOrCreate: jest.fn(),
    update: jest.fn(),
  };
  const scheduler = { rescheduleDailyMail: jest.fn() };
  const controller = new TendersController(
    query as never,
    subscription as never,
    scheduler as never,
  );

  beforeEach(() => {
    Object.values(query).forEach((method) => method.mockReset());
    Object.values(subscription).forEach((method) => method.mockReset());
    scheduler.rescheduleDailyMail.mockReset();
  });

  it("protects every tender endpoint with the JWT guard", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TendersController)).toContain(
      JwtAuthGuard,
    );
  });

  it("declares the calendar and subscription static routes before the ID route", () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, TendersController.prototype.calendar),
    ).toBe("calendar");
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        TendersController.prototype.subscription,
      ),
    ).toBe("subscription");
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        TendersController.prototype.updateSubscription,
      ),
    ).toBe("subscription");
    expect(
      Reflect.getMetadata(PATH_METADATA, TendersController.prototype.findOne),
    ).toBe(":id");
  });

  it("returns and replaces only the shared subscription settings", async () => {
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
    const update = {
      enabled: true,
      deliveryTime: "12:30",
      recipients: ["sales@dfkorea.co.kr"],
    };

    await expect(controller.subscription()).resolves.toEqual({
      enabled: false,
      deliveryTime: "09:00",
      recipients: [],
    });
    await expect(controller.updateSubscription(update)).resolves.toEqual({
      enabled: true,
      deliveryTime: "12:30",
      recipients: ["sales@dfkorea.co.kr"],
    });
    expect(subscription.update).toHaveBeenCalledWith(update);
    expect(scheduler.rescheduleDailyMail).toHaveBeenCalledWith("12:30", true);
  });

  it("passes independent calendar list filters through without adding email filter state", async () => {
    query.getTenders.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
    const filters = { source: TenderSource.G2B, page: 1, pageSize: 20 };

    await expect(controller.findAll(filters as never)).resolves.toEqual(
      expect.objectContaining({ total: 0 }),
    );
    expect(query.getTenders).toHaveBeenCalledWith(filters);
  });

  it("passes shared query filters to calendar aggregation without email state", async () => {
    query.getCalendar.mockResolvedValue([]);
    const filters = { month: "2026-08", source: TenderSource.G2B };

    await expect(controller.calendar(filters as never)).resolves.toEqual([]);
    expect(query.getCalendar).toHaveBeenCalledWith("2026-08", filters);
  });

  it("uses a standard Nest not-found response for an unknown tender", async () => {
    query.getTender.mockResolvedValue(null);

    await expect(
      controller.findOne("00000000-0000-4000-8000-000000000001"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

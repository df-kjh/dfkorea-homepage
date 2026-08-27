jest.mock("node-cron", () => ({ schedule: jest.fn() }));

import { schedule } from "node-cron";
import { TenderSchedulerService } from "./tender-scheduler.service";

describe("TenderSchedulerService", () => {
  beforeEach(() => {
    (schedule as jest.Mock).mockReset();
  });

  it("registers only midnight and noon collection in Korea Standard Time", () => {
    const ingestion = { collectAll: jest.fn() };
    const mail = { sendDailyDigest: jest.fn(), retryDue: jest.fn() };
    const subscription = { getOrCreate: jest.fn().mockResolvedValue({ enabled: false, deliveryTime: "09:00" }) };
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock).mockReturnValueOnce(task).mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() });
    const service = new TenderSchedulerService(ingestion as never, mail as never, subscription as never);

    service.onModuleInit();

    expect(schedule).toHaveBeenCalledWith(
      "0 0 0,12 * * *",
      expect.any(Function),
      {
        timezone: "Asia/Seoul",
        noOverlap: true,
      },
    );
  });

  it("runs collection through the ingestion boundary and releases its cron task", async () => {
    const ingestion = { collectAll: jest.fn().mockResolvedValue(undefined) };
    const mail = { sendDailyDigest: jest.fn(), retryDue: jest.fn() };
    const subscription = { getOrCreate: jest.fn().mockResolvedValue({ enabled: false, deliveryTime: "09:00" }) };
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock).mockReturnValueOnce(task).mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() });
    const service = new TenderSchedulerService(ingestion as never, mail as never, subscription as never);

    await service.onModuleInit();
    const callback = (schedule as jest.Mock).mock.calls[0][1];
    await callback();
    service.onModuleDestroy();

    expect(ingestion.collectAll).toHaveBeenCalledWith(expect.any(Date));
    expect(task.stop).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it("loads the shared setting, dynamically replaces one KST daily mail job, and scans retries every minute", async () => {
    const ingestion = { collectAll: jest.fn() };
    const mail = { sendDailyDigest: jest.fn(), retryDue: jest.fn() };
    const subscription = { getOrCreate: jest.fn().mockResolvedValue({ enabled: true, deliveryTime: "13:45" }) };
    const collectionTask = { stop: jest.fn(), destroy: jest.fn() };
    const dailyTask = { stop: jest.fn(), destroy: jest.fn() };
    const retryTask = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock).mockReturnValueOnce(collectionTask).mockReturnValueOnce(retryTask).mockReturnValueOnce(dailyTask);
    const service = new TenderSchedulerService(ingestion as never, mail as never, subscription as never);

    await service.onModuleInit();
    const dailyCallback = (schedule as jest.Mock).mock.calls[2][1];
    await dailyCallback();
    service.rescheduleDailyMail("09:30", false);

    expect(schedule).toHaveBeenCalledWith("0 * * * * *", expect.any(Function), { timezone: "Asia/Seoul", noOverlap: true });
    expect(schedule).toHaveBeenCalledWith("0 45 13 * * *", expect.any(Function), { timezone: "Asia/Seoul", noOverlap: true });
    expect(mail.sendDailyDigest).toHaveBeenCalledWith(expect.any(Date));
    expect(dailyTask.stop).toHaveBeenCalledTimes(1);
    expect(dailyTask.destroy).toHaveBeenCalledTimes(1);
  });
});

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
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock)
      .mockReturnValueOnce(task)
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() })
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() });
    const service = new TenderSchedulerService(ingestion as never, mail as never);

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
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock)
      .mockReturnValueOnce(task)
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() })
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() });
    const service = new TenderSchedulerService(ingestion as never, mail as never);

    await service.onModuleInit();
    const callback = (schedule as jest.Mock).mock.calls[0][1];
    await callback();
    service.onModuleDestroy();

    expect(ingestion.collectAll).toHaveBeenCalledWith(expect.any(Date));
    expect(task.stop).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it("checks shared daily settings and durable retries every minute without an exact-time local job", async () => {
    const ingestion = { collectAll: jest.fn() };
    const mail = { sendDailyDigest: jest.fn(), retryDue: jest.fn() };
    const collectionTask = { stop: jest.fn(), destroy: jest.fn() };
    const dailyTask = { stop: jest.fn(), destroy: jest.fn() };
    const retryTask = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock).mockReturnValueOnce(collectionTask).mockReturnValueOnce(retryTask).mockReturnValueOnce(dailyTask);
    const service = new TenderSchedulerService(ingestion as never, mail as never);

    await service.onModuleInit();
    const dailyCallback = (schedule as jest.Mock).mock.calls[1][1];
    await dailyCallback();

    expect(schedule).toHaveBeenCalledWith("0 * * * * *", expect.any(Function), { timezone: "Asia/Seoul", noOverlap: true });
    expect(schedule).toHaveBeenCalledTimes(3);
    expect(schedule).not.toHaveBeenCalledWith(expect.stringMatching(/45 13/), expect.anything(), expect.anything());
    expect(mail.sendDailyDigest).toHaveBeenCalledWith(expect.any(Date));
    service.onModuleDestroy();
    expect(dailyTask.stop).toHaveBeenCalledTimes(1);
    expect(dailyTask.destroy).toHaveBeenCalledTimes(1);
  });
});

jest.mock("node-cron", () => ({ schedule: jest.fn() }));

import { schedule } from "node-cron";
import { TenderSchedulerService } from "./tender-scheduler.service";

describe("TenderSchedulerService", () => {
  beforeEach(() => {
    (schedule as jest.Mock).mockReset();
  });

  it("refreshes fingerprints before hourly analysis, runs bounded batches away from award collection, and destroys all jobs", async () => {
    const order: string[] = [];
    const analysis = {
      refreshStaleAnalyses: jest.fn(async () => {
        order.push("refresh");
      }),
      processDue: jest.fn(async () => {
        order.push("process");
      }),
    };
    const awards = { collectIncremental: jest.fn() };
    const tasks: { stop: jest.Mock; destroy: jest.Mock }[] = [];
    (schedule as jest.Mock).mockImplementation(() => {
      const task = { stop: jest.fn(), destroy: jest.fn() };
      tasks.push(task);
      return task;
    });
    const Service = TenderSchedulerService as any;
    const service = new Service(
      { collectAll: jest.fn() },
      { sendDailyDigest: jest.fn(), retryDue: jest.fn() },
      analysis,
      awards,
    );
    await service.onModuleInit();
    expect(tasks).toHaveLength(7);
    await (schedule as jest.Mock).mock.calls.find(
      ([cron]) => cron === "10 2 * * * *",
    )[1]();
    expect(order).toEqual(["refresh", "process"]);
    const awardJobs = (schedule as jest.Mock).mock.calls.filter(([cron]) =>
      ["0 15 2 * * *", "30 5-50/5 * * * *"].includes(cron),
    );
    expect(awardJobs).toHaveLength(2);
    for (const [, callback] of awardJobs) await callback();
    expect(awards.collectIncremental).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    for (const task of tasks) expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it("registers hourly collection in Korea Standard Time", () => {
    const ingestion = { collectAll: jest.fn() };
    const mail = { sendDailyDigest: jest.fn(), retryDue: jest.fn() };
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock)
      .mockReturnValue({ stop: jest.fn(), destroy: jest.fn() })
      .mockReturnValueOnce(task)
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() })
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() });
    const service = new TenderSchedulerService(
      ingestion as never,
      mail as never,
      { refreshStaleAnalyses: jest.fn(), processDue: jest.fn() } as never,
      { collectIncremental: jest.fn() } as never,
    );

    service.onModuleInit();

    expect(schedule).toHaveBeenCalledWith("0 0 * * * *", expect.any(Function), {
      timezone: "Asia/Seoul",
      noOverlap: true,
    });
  });

  it("runs collection through the ingestion boundary and releases its cron task", async () => {
    const ingestion = { collectAll: jest.fn().mockResolvedValue(undefined) };
    const mail = { sendDailyDigest: jest.fn(), retryDue: jest.fn() };
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock)
      .mockReturnValue({ stop: jest.fn(), destroy: jest.fn() })
      .mockReturnValueOnce(task)
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() })
      .mockReturnValueOnce({ stop: jest.fn(), destroy: jest.fn() });
    const service = new TenderSchedulerService(
      ingestion as never,
      mail as never,
      { refreshStaleAnalyses: jest.fn(), processDue: jest.fn() } as never,
      { collectIncremental: jest.fn() } as never,
    );

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
    (schedule as jest.Mock)
      .mockReturnValue({ stop: jest.fn(), destroy: jest.fn() })
      .mockReturnValueOnce(collectionTask)
      .mockReturnValueOnce(retryTask)
      .mockReturnValueOnce(dailyTask);
    const service = new TenderSchedulerService(
      ingestion as never,
      mail as never,
      { refreshStaleAnalyses: jest.fn(), processDue: jest.fn() } as never,
      { collectIncremental: jest.fn() } as never,
    );

    await service.onModuleInit();
    const dailyCallback = (schedule as jest.Mock).mock.calls[1][1];
    await dailyCallback();

    expect(schedule).toHaveBeenCalledWith("0 * * * * *", expect.any(Function), {
      timezone: "Asia/Seoul",
      noOverlap: true,
    });
    expect(schedule).toHaveBeenCalledTimes(7);
    expect(schedule).not.toHaveBeenCalledWith(
      expect.stringMatching(/45 13/),
      expect.anything(),
      expect.anything(),
    );
    expect(mail.sendDailyDigest).toHaveBeenCalledWith(expect.any(Date));
    service.onModuleDestroy();
    expect(dailyTask.stop).toHaveBeenCalledTimes(1);
    expect(dailyTask.destroy).toHaveBeenCalledTimes(1);
  });
});

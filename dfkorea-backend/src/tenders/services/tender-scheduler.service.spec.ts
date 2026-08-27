jest.mock("node-cron", () => ({ schedule: jest.fn() }));

import { schedule } from "node-cron";
import { TenderSchedulerService } from "./tender-scheduler.service";

describe("TenderSchedulerService", () => {
  beforeEach(() => {
    (schedule as jest.Mock).mockReset();
  });

  it("registers only midnight and noon collection in Korea Standard Time", () => {
    const ingestion = { collectAll: jest.fn() };
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock).mockReturnValue(task);
    const service = new TenderSchedulerService(ingestion as never);

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
    const task = { stop: jest.fn(), destroy: jest.fn() };
    (schedule as jest.Mock).mockReturnValue(task);
    const service = new TenderSchedulerService(ingestion as never);

    service.onModuleInit();
    const callback = (schedule as jest.Mock).mock.calls[0][1];
    await callback();
    service.onModuleDestroy();

    expect(ingestion.collectAll).toHaveBeenCalledWith(expect.any(Date));
    expect(task.stop).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });
});

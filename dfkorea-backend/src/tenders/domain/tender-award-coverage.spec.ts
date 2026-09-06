import { planIncrementalAwardWindows } from "./tender-award-window";
import { TenderAwardSyncStatus as Status } from "./tender-analysis.enums";
const completed = (start: string, end: string) => ({
  periodStart: start,
  periodEnd: end,
  status: Status.SUCCEEDED,
});
describe("durable award coverage", () => {
  it("catches downtime over month boundaries from the last contiguous completed date", () => {
    expect(
      planIncrementalAwardWindows(new Date("2026-11-10T00:00:00Z"), [
        completed("2024-09-07", "2026-09-07"),
      ]),
    ).toEqual([
      { start: "2026-09-01", end: "2026-09-30" },
      { start: "2026-10-01", end: "2026-10-31" },
      { start: "2026-11-01", end: "2026-11-10" },
    ]);
  });
  it("does not mistake a later completed window for coverage over an earlier gap", () => {
    const windows = planIncrementalAwardWindows(
      new Date("2026-04-15T00:00:00Z"),
      [
        completed("2026-01-01", "2026-01-31"),
        completed("2026-03-01", "2026-03-31"),
      ],
    );
    expect(windows).toContainEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(windows[0].start).toBe("2026-01-25");
  });
  it("does not reseed a completed current day or advance past unfinished coverage", () => {
    expect(
      planIncrementalAwardWindows(new Date("2026-09-07T03:00:00Z"), [
        completed("2026-09-01", "2026-09-07"),
      ]),
    ).toEqual([]);
    const windows = planIncrementalAwardWindows(
      new Date("2026-09-07T03:00:00Z"),
      [
        { ...completed("2026-08-01", "2026-08-31"), status: Status.PARTIAL },
        completed("2026-09-01", "2026-09-07"),
      ],
    );
    expect(windows[0].start).toBe("2026-08-01");
  });
});

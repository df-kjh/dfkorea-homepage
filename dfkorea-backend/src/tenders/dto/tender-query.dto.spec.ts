import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { TenderListQueryDto } from "./tender-query.dto";

describe("TenderListQueryDto", () => {
  it("transforms numeric pagination and accepts the documented registered-date filter", async () => {
    const dto = plainToInstance<TenderListQueryDto, object>(TenderListQueryDto, {
      registeredDate: "2026-08-31",
      page: "2",
      pageSize: "100",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(100);
  });

  it.each([
    { registeredDate: "2026-8-1" },
    { registeredDate: "2026-02-30" },
    { page: "0" },
    { pageSize: "101" },
  ])("rejects invalid query input %#", async (input) => {
    const dto = plainToInstance<TenderListQueryDto, object>(TenderListQueryDto, input);

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});

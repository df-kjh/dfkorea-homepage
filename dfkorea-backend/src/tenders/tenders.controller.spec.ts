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
  const controller = new TendersController(query as never);

  beforeEach(() => {
    Object.values(query).forEach((method) => method.mockReset());
  });

  it("protects every tender endpoint with the JWT guard", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TendersController)).toContain(JwtAuthGuard);
  });

  it("declares the calendar static route before the ID route", () => {
    expect(Reflect.getMetadata(PATH_METADATA, TendersController.prototype.calendar)).toBe("calendar");
    expect(Reflect.getMetadata(PATH_METADATA, TendersController.prototype.findOne)).toBe(":id");
  });

  it("passes independent calendar list filters through without adding email filter state", async () => {
    query.getTenders.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    const filters = { source: TenderSource.G2B, page: 1, pageSize: 20 };

    await expect(controller.findAll(filters as never)).resolves.toEqual(expect.objectContaining({ total: 0 }));
    expect(query.getTenders).toHaveBeenCalledWith(filters);
  });

  it("uses a standard Nest not-found response for an unknown tender", async () => {
    query.getTender.mockResolvedValue(null);

    await expect(controller.findOne("00000000-0000-4000-8000-000000000001")).rejects.toBeInstanceOf(NotFoundException);
  });
});

import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  TenderCalendarQueryDto,
  TenderListQueryDto,
} from "./dto/tender-query.dto";
import { TenderQueryService } from "./services/tender-query.service";

@Controller("tenders")
@UseGuards(JwtAuthGuard)
export class TendersController {
  constructor(private readonly tenderQueryService: TenderQueryService) {}

  @Get("calendar")
  calendar(@Query() query: TenderCalendarQueryDto) {
    return this.tenderQueryService.getCalendar(query.month);
  }

  @Get()
  findAll(@Query() query: TenderListQueryDto) {
    return this.tenderQueryService.getTenders(query);
  }

  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    const tender = await this.tenderQueryService.getTender(id);
    if (!tender) {
      throw new NotFoundException("Tender not found");
    }
    return tender;
  }
}

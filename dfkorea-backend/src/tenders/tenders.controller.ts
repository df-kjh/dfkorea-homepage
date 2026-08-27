import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  TenderCalendarQueryDto,
  TenderListQueryDto,
} from "./dto/tender-query.dto";
import { TenderQueryService } from "./services/tender-query.service";
import { UpdateTenderSubscriptionDto } from "./dto/update-tender-subscription.dto";
import { TenderSubscriptionService } from "./services/tender-subscription.service";

@Controller("tenders")
@UseGuards(JwtAuthGuard)
export class TendersController {
  constructor(
    private readonly tenderQueryService: TenderQueryService,
    private readonly tenderSubscriptionService: TenderSubscriptionService,
  ) {}

  @Get("calendar")
  calendar(@Query() query: TenderCalendarQueryDto) {
    return this.tenderQueryService.getCalendar(query.month);
  }

  @Get("subscription")
  subscription() {
    return this.tenderSubscriptionService.getOrCreate();
  }

  @Put("subscription")
  updateSubscription(@Body() updateDto: UpdateTenderSubscriptionDto) {
    return this.tenderSubscriptionService.update(updateDto);
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

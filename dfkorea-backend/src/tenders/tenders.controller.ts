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
import { TenderSchedulerService } from "./services/tender-scheduler.service";
import { TenderSubscriptionQueryDto } from "./dto/tender-subscription-query.dto";

@Controller("tenders")
@UseGuards(JwtAuthGuard)
export class TendersController {
  constructor(
    private readonly tenderQueryService: TenderQueryService,
    private readonly tenderSubscriptionService: TenderSubscriptionService,
    private readonly tenderSchedulerService: TenderSchedulerService,
  ) {}

  @Get("calendar")
  calendar(@Query() query: TenderCalendarQueryDto) {
    return this.tenderQueryService.getCalendar(query.month, query);
  }

  @Get("subscription")
  subscription(@Query() _query?: TenderSubscriptionQueryDto) {
    // Reading the empty DTO is intentional: it activates the global whitelist
    // so display filters cannot silently become email-delivery filters.
    void _query;
    return this.tenderSubscriptionService.getOrCreate();
  }

  @Put("subscription")
  async updateSubscription(@Body() updateDto: UpdateTenderSubscriptionDto) {
    const subscription = await this.tenderSubscriptionService.update(updateDto);
    // Rescheduling occurs only after the transaction resolves, so an in-memory
    // job can never point at a setting that was rolled back in PostgreSQL.
    this.tenderSchedulerService.rescheduleDailyMail(
      subscription.deliveryTime,
      subscription.enabled,
    );
    return subscription;
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

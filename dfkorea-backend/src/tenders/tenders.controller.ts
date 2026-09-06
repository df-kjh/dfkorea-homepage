import { Req, HttpCode, HttpStatus } from "@nestjs/common";
import { Request } from "express";
import { TenderAnalysisService } from "./services/tender-analysis.service";
import { TenderAwardCollectorService } from "./services/tender-award-collector.service";
import { SaveTenderAnalysisReviewDto } from "./dto/tender-analysis.dto";
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
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
import { TenderSubscriptionQueryDto } from "./dto/tender-subscription-query.dto";
import { TenderIngestionService } from "./services/tender-ingestion.service";
import { ReplaceTenderCompanyProfileDto } from "./dto/tender-company-profile.dto";
import { TenderCompanyProfileService } from "./services/tender-company-profile.service";

@Controller("tenders")
@UseGuards(JwtAuthGuard)
export class TendersController {
  constructor(
    private readonly tenderQueryService: TenderQueryService,
    private readonly tenderSubscriptionService: TenderSubscriptionService,
    private readonly tenderIngestionService: TenderIngestionService,
    private readonly tenderCompanyProfileService: TenderCompanyProfileService,
    private readonly analysisService: TenderAnalysisService,
    private readonly awardCollector: TenderAwardCollectorService,
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
    return subscription;
  }

  @Get("company-profile")
  companyProfile() {
    return this.tenderCompanyProfileService.get();
  }

  @Put("company-profile")
  replaceCompanyProfile(@Body() profile: ReplaceTenderCompanyProfileDto) {
    return this.tenderCompanyProfileService.replace(profile);
  }

  @Get()
  findAll(@Query() query: TenderListQueryDto) {
    return this.tenderQueryService.getTenders(query);
  }

  @Post("collect")
  collect() {
    return this.tenderIngestionService.collectAll(new Date());
  }

  @Post("award-results/backfill")
  @HttpCode(HttpStatus.ACCEPTED)
  backfillAwards() {
    return this.awardCollector.startBackfill(new Date());
  }

  @Get("award-results/status")
  awardStatus() {
    return this.awardCollector.getStatus();
  }

  @Get(":id/analysis")
  analysis(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.analysisService.getAnalysis(id);
  }

  @Post(":id/analysis")
  @HttpCode(HttpStatus.ACCEPTED)
  reanalyze(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.analysisService.reanalyze(id, new Date());
  }

  @Post(":id/review")
  async saveReview(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: SaveTenderAnalysisReviewDto,
    @Req() request: Request & { user: { username: string } },
  ) {
    // Existing JWTs identify the authenticated username. Resolve its persisted
    // UUID server-side rather than accepting a reviewer ID from the request.
    const adminId = await this.analysisService.resolveAdminId(
      request.user.username,
    );
    return this.analysisService.saveReview(id, dto, adminId);
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

import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PaginatedTenderDto,
  TenderCalendarDayDto,
  TenderDetailDto,
  TenderListQueryDto,
  TenderSummaryDto,
} from "../dto/tender-query.dto";
import { Tender } from "../entities/tender.entity";

const KST_OFFSET_HOURS = -9;
@Injectable()
export class TenderQueryService {
  constructor(
    @InjectRepository(Tender)
    private readonly tenderRepository: Repository<Tender>,
  ) {}

  async getCalendar(month: string): Promise<TenderCalendarDayDto[]> {
    const { start, end } = this.getKstMonthBounds(month);
    const localRegisteredDate =
      "(tender.registeredAt AT TIME ZONE 'Asia/Seoul')::date";
    const rows = await this.tenderRepository
      .createQueryBuilder("tender")
      .select(localRegisteredDate, "date")
      .addSelect("tender.relevance", "relevance")
      .addSelect("COUNT(*)", "count")
      .where("tender.registeredAt >= :start AND tender.registeredAt < :end", {
        start,
        end,
      })
      .groupBy(localRegisteredDate)
      .addGroupBy("tender.relevance")
      .orderBy(localRegisteredDate, "ASC")
      .getRawMany<{
        date: string;
        relevance: string;
        count: string;
      }>();

    const grouped = new Map<string, TenderCalendarDayDto>();
    for (const row of rows) {
      const day = grouped.get(row.date) ?? {
        date: row.date,
        total: 0,
        direct: 0,
        potential: 0,
      };
      const count = Number(row.count);
      day.total += count;
      if (row.relevance === "DIRECT") {
        day.direct += count;
      } else if (row.relevance === "POTENTIAL") {
        day.potential += count;
      }
      grouped.set(row.date, day);
    }
    return [...grouped.values()];
  }

  async getTenders(
    query: TenderListQueryDto,
  ): Promise<PaginatedTenderDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const builder = this.tenderRepository.createQueryBuilder("tender");

    if (query.registeredDate) {
      const { start, end } = this.getKstDateBounds(query.registeredDate);
      builder.andWhere(
        "tender.registeredAt >= :registeredStart AND tender.registeredAt < :registeredEnd",
        { registeredStart: start, registeredEnd: end },
      );
    }
    if (query.keyword) {
      builder.andWhere(
        "(tender.title ILIKE :keyword ESCAPE '\\\\' OR tender.orderingOrganization ILIKE :keyword ESCAPE '\\\\' OR tender.demandOrganization ILIKE :keyword ESCAPE '\\\\')",
        { keyword: `%${this.escapeLikeKeyword(query.keyword)}%` },
      );
    }
    if (query.source) {
      builder.andWhere("tender.source = :source", { source: query.source });
    }
    if (query.region) {
      builder.andWhere("tender.region = :region", { region: query.region });
    }
    if (query.procurementType) {
      builder.andWhere("tender.procurementType = :procurementType", {
        procurementType: query.procurementType,
      });
    }
    if (query.relevance) {
      builder.andWhere("tender.relevance = :relevance", {
        relevance: query.relevance,
      });
    }

    const [tenders, total] = await builder
      .orderBy("tender.registeredAt", "DESC")
      // Registration timestamps can match across sources, so use the UUID as
      // a stable tie-breaker for deterministic pages.
      .addOrderBy("tender.id", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: tenders.map((tender) => this.toSafeDto(tender)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getTender(id: string): Promise<TenderDetailDto | null> {
    const tender = await this.tenderRepository
      .createQueryBuilder("tender")
      .where("tender.id = :id", { id })
      .getOne();
    return tender ? this.toSafeDto(tender) : null;
  }

  private toSafeDto(tender: Tender): TenderSummaryDto {
    // `rawData` may contain upstream payloads or authentication-adjacent
    // fields. The admin can inspect normalized details and classifier reasons,
    // but source raw data is intentionally never part of the HTTP contract.
    return {
      id: tender.id,
      source: tender.source,
      sourceNoticeId: tender.sourceNoticeId,
      revision: tender.revision,
      title: tender.title,
      orderingOrganization: tender.orderingOrganization,
      demandOrganization: tender.demandOrganization,
      registeredAt: tender.registeredAt,
      bidStartedAt: tender.bidStartedAt,
      bidEndedAt: tender.bidEndedAt,
      openedAt: tender.openedAt,
      region: tender.region,
      procurementType: tender.procurementType,
      contractMethod: tender.contractMethod,
      estimatedAmount: tender.estimatedAmount,
      sourceUrl: tender.sourceUrl,
      relevance: tender.relevance,
      relevanceScore: tender.relevanceScore,
      relevanceReasons: tender.relevanceReasons,
    };
  }

  private getKstMonthBounds(month: string): { start: Date; end: Date } {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) {
      throw new BadRequestException("month must use YYYY-MM");
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;

    return {
      start: this.kstMidnightToUtc(year, monthIndex, 1),
      end: this.kstMidnightToUtc(year, monthIndex + 1, 1),
    };
  }

  private getKstDateBounds(date: string): { start: Date; end: Date } {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) {
      throw new BadRequestException("registeredDate must use YYYY-MM-DD");
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const start = this.kstMidnightToUtc(year, monthIndex, day);
    const end = this.kstMidnightToUtc(year, monthIndex, day + 1);
    if (!this.isKstCalendarDate(start, year, monthIndex, day)) {
      throw new BadRequestException("registeredDate must be a calendar date");
    }
    return { start, end };
  }

  private kstMidnightToUtc(year: number, monthIndex: number, day: number): Date {
    // Korea has a fixed UTC+09:00 offset and does not observe DST. Date.UTC
    // safely handles last-day and year rollover for exclusive end bounds.
    return new Date(Date.UTC(year, monthIndex, day, KST_OFFSET_HOURS));
  }

  private isKstCalendarDate(
    utcDate: Date,
    year: number,
    monthIndex: number,
    day: number,
  ): boolean {
    const local = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
    return (
      local.getUTCFullYear() === year &&
      local.getUTCMonth() === monthIndex &&
      local.getUTCDate() === day
    );
  }

  private escapeLikeKeyword(keyword: string): string {
    return keyword.replace(/[\\%_]/g, "\\$&");
  }
}

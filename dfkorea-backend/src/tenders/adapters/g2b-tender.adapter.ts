import {
  NormalizedTender,
  TenderLicenseLimit,
} from "../domain/normalized-tender";
import {
  TenderFetchWindow,
  TenderSourceAdapter,
} from "../domain/tender-source.adapter";
import { ProcurementType, TenderSource } from "../domain/tender.enums";
import {
  formatKstDateTimeMinute,
  parseKstDate,
  TenderApiClient,
  toNullableText,
} from "./public-api-client";

export interface G2bTenderAdapterConfig {
  baseUrl: string;
  serviceKey: string;
}

const G2B_OPERATIONS: ReadonlyArray<[string, ProcurementType]> = [
  ["getBidPblancListInfoCnstwk", ProcurementType.CONSTRUCTION],
  ["getBidPblancListInfoThng", ProcurementType.GOODS],
  ["getBidPblancListInfoServc", ProcurementType.SERVICE],
];
const LICENSE_LIMIT_OPERATION = "getBidPblancListInfoLicenseLimit";

export class G2bTenderAdapter implements TenderSourceAdapter {
  readonly source = TenderSource.G2B;

  constructor(
    private readonly client: TenderApiClient,
    private readonly config: G2bTenderAdapterConfig,
  ) {}

  async fetchNotices(window: TenderFetchWindow): Promise<NormalizedTender[]> {
    const query = {
      serviceKey: this.config.serviceKey,
      type: "json",
      inqryDiv: "1",
      inqryBgnDt: formatKstDateTimeMinute(window.from),
      inqryEndDt: formatKstDateTimeMinute(window.to),
    };
    const [collections, licenseLimitRows] = await Promise.all([
      Promise.all(
        G2B_OPERATIONS.map(async ([operation, procurementType]) => {
          const rows = await this.client.getAllPages({
            source: this.source,
            baseUrl: this.config.baseUrl,
            operation,
            query,
          });

          return rows.flatMap((row) => {
            const normalized = this.normalize(row, procurementType);
            return normalized ? [normalized] : [];
          });
        }),
      ),
      this.client.getAllPages({
        source: this.source,
        baseUrl: this.config.baseUrl,
        operation: LICENSE_LIMIT_OPERATION,
        query,
      }),
    ]);
    const licenseLimitsByNotice = this.groupLicenseLimits(licenseLimitRows);

    return collections.flat().map((notice) => ({
      ...notice,
      licenseLimits:
        licenseLimitsByNotice.get(
          this.toNoticeKey(notice.sourceNoticeId, notice.revision),
        ) ?? [],
    }));
  }

  private groupLicenseLimits(
    rows: Record<string, unknown>[],
  ): Map<string, TenderLicenseLimit[]> {
    const licenseLimitsByNotice = new Map<string, TenderLicenseLimit[]>();

    for (const row of rows) {
      const sourceNoticeId = toNullableText(row.bidNtceNo);
      if (!sourceNoticeId) {
        continue;
      }

      const name = toNullableText(row.lcnsLmtNm) ?? "";
      const permittedIndustries = toNullableText(row.permsnIndstrytyList) ?? "";
      if (!name && !permittedIndustries) {
        continue;
      }

      const key = this.toNoticeKey(
        sourceNoticeId,
        toNullableText(row.bidNtceOrd) ?? "0",
      );
      const licenseLimits = licenseLimitsByNotice.get(key) ?? [];
      licenseLimits.push({ name, permittedIndustries });
      licenseLimitsByNotice.set(key, licenseLimits);
    }

    return licenseLimitsByNotice;
  }

  private toNoticeKey(sourceNoticeId: string, revision: string): string {
    return `${sourceNoticeId}:${revision}`;
  }

  private normalize(
    row: Record<string, unknown>,
    procurementType: ProcurementType,
  ): NormalizedTender | null {
    const sourceNoticeId = toNullableText(row.bidNtceNo);
    const title = toNullableText(row.bidNtceNm);
    const orderingOrganization = toNullableText(row.ntceInsttNm);
    const registeredAt = parseKstDate(row.bidNtceDt);
    if (!sourceNoticeId || !title || !orderingOrganization || !registeredAt) {
      return null;
    }

    const revision = toNullableText(row.bidNtceOrd) ?? "0";
    return {
      source: this.source,
      sourceNoticeId,
      revision,
      title,
      orderingOrganization,
      demandOrganization: toNullableText(row.dminsttNm),
      registeredAt,
      bidStartedAt: parseKstDate(row.bidBeginDt),
      bidEndedAt: parseKstDate(row.bidClseDt),
      openedAt: parseKstDate(row.opengDt),
      region: toNullableText(row.prtcptLmtRgnNm),
      procurementType,
      contractMethod: toNullableText(row.cntrctCnclsMthdNm),
      estimatedAmount: toNullableText(row.presmptPrce),
      sourceUrl:
        toNullableText(row.bidNtceDtlUrl) ??
        `https://www.g2b.go.kr/ep/tbid/tbidFwd.do?bidno=${encodeURIComponent(sourceNoticeId)}&bidseq=${encodeURIComponent(revision)}`,
      itemName: toNullableText(row.prdctClsfcNoNm) ?? "",
      description: toNullableText(row.bidNtceDtl) ?? "",
      attachmentNames: Array.from({ length: 10 }, (_, index) =>
        toNullableText(row[`ntceSpecDocNm${index + 1}`]),
      ).filter((name): name is string => name !== null),
      licenseLimits: [],
      rawData: row,
    };
  }
}

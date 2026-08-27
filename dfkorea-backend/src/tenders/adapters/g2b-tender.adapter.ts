import { NormalizedTender } from "../domain/normalized-tender";
import {
  TenderFetchWindow,
  TenderSourceAdapter,
} from "../domain/tender-source.adapter";
import { ProcurementType, TenderSource } from "../domain/tender.enums";
import {
  formatKstDate,
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

export class G2bTenderAdapter implements TenderSourceAdapter {
  readonly source = TenderSource.G2B;

  constructor(
    private readonly client: TenderApiClient,
    private readonly config: G2bTenderAdapterConfig,
  ) {}

  async fetchNotices(window: TenderFetchWindow): Promise<NormalizedTender[]> {
    const collections = await Promise.all(
      G2B_OPERATIONS.map(async ([operation, procurementType]) => {
        const rows = await this.client.getAllPages({
          source: this.source,
          baseUrl: this.config.baseUrl,
          operation,
          query: {
            serviceKey: this.config.serviceKey,
            _type: "json",
            inqryDiv: "1",
            inqryBgnDt: formatKstDate(window.from),
            inqryEndDt: formatKstDate(window.to),
          },
        });

        return rows.flatMap((row) => {
          const normalized = this.normalize(row, procurementType);
          return normalized ? [normalized] : [];
        });
      }),
    );

    return collections.flat();
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
      attachmentNames: [],
      rawData: row,
    };
  }
}

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

export interface KaptTenderAdapterConfig {
  baseUrl: string;
  serviceKey: string;
}

export class KaptTenderAdapter implements TenderSourceAdapter {
  readonly source = TenderSource.KAPT;

  constructor(
    private readonly client: TenderApiClient,
    private readonly config: KaptTenderAdapterConfig,
  ) {}

  async fetchNotices(window: TenderFetchWindow): Promise<NormalizedTender[]> {
    const rows = await this.client.getAllPages({
      source: this.source,
      baseUrl: this.config.baseUrl,
      operation: "getPblAncDeSearchV3",
      query: {
        serviceKey: this.config.serviceKey,
        _type: "json",
        startDate: formatKstDate(window.from),
        endDate: formatKstDate(window.to),
      },
    });

    return rows.flatMap((row) => {
      const normalized = this.normalize(row);
      return normalized ? [normalized] : [];
    });
  }

  private normalize(row: Record<string, unknown>): NormalizedTender | null {
    const sourceNoticeId = toNullableText(row.bidNum);
    const title = toNullableText(row.bidTitle);
    const orderingOrganization = toNullableText(row.bidKaptname);
    const registeredAt = parseKstDate(row.bidRegDate);
    if (!sourceNoticeId || !title || !orderingOrganization || !registeredAt) {
      return null;
    }

    const revision = toNullableText(row.bidFileSeq) ?? "0";
    return {
      source: this.source,
      sourceNoticeId,
      revision,
      title,
      orderingOrganization,
      demandOrganization: null,
      registeredAt,
      bidStartedAt: null,
      bidEndedAt: parseKstDate(row.bidDeadline),
      openedAt: null,
      region: toNullableText(row.bidArea),
      // The V3 list fields expose a status, not a procurement category. Do not
      // infer a type from the title or status; classification is a later step.
      procurementType: ProcurementType.OTHER,
      contractMethod: null,
      estimatedAmount: null,
      sourceUrl: `https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=${encodeURIComponent(sourceNoticeId)}`,
      itemName: "",
      description: toNullableText(row.bidContent) ?? "",
      attachmentNames: [],
      rawData: row,
    };
  }
}

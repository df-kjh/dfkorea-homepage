import { NormalizedTender } from "../domain/normalized-tender";
import {
  TenderFetchWindow,
  TenderSourceAdapter,
  TenderSourceFetchResult,
} from "../domain/tender-source.adapter";
import {
  ProcurementType,
  SyncRunStatus,
  TenderSource,
} from "../domain/tender.enums";
import {
  formatKstDate,
  parseKstDate,
  TenderApiClient,
  TenderSourceError,
  toNullableText,
} from "./public-api-client";

export interface KepcoTenderAdapterConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  listOperation?: string;
}

export class KepcoTenderAdapter implements TenderSourceAdapter {
  readonly source = TenderSource.KEPCO;

  constructor(
    private readonly client: TenderApiClient,
    private readonly config: KepcoTenderAdapterConfig,
  ) {
    if (config.enabled && (!config.baseUrl.trim() || !config.apiKey.trim())) {
      throw new TenderSourceError(this.source, "CONFIGURATION_ERROR", null);
    }
  }

  async fetchNotices(
    window: TenderFetchWindow,
  ): Promise<TenderSourceFetchResult> {
    if (!this.config.enabled) {
      return {
        notices: [],
        status: SyncRunStatus.SUCCEEDED,
        errorCode: null,
      };
    }

    const rows = await this.client.getAllPages({
      source: this.source,
      baseUrl: this.config.baseUrl,
      operation: this.config.listOperation ?? "bid-notices",
      query: {
        apiKey: this.config.apiKey,
        startDate: formatKstDate(window.from),
        endDate: formatKstDate(window.to),
      },
    });

    return {
      notices: rows.flatMap((row) => {
        const normalized = this.normalize(row);
        return normalized ? [normalized] : [];
      }),
      status: SyncRunStatus.SUCCEEDED,
      errorCode: null,
    };
  }

  private normalize(row: Record<string, unknown>): NormalizedTender | null {
    const sourceNoticeId = toNullableText(row.noticeNo);
    const title = toNullableText(row.noticeTitle);
    const orderingOrganization = toNullableText(row.orderingOrganization);
    const sourceUrl = toNullableText(row.detailUrl);
    const registeredAt = parseKstDate(row.registeredAt);
    if (
      !sourceNoticeId ||
      !title ||
      !orderingOrganization ||
      !sourceUrl ||
      !registeredAt
    ) {
      return null;
    }

    return {
      source: this.source,
      sourceNoticeId,
      revision: toNullableText(row.noticeSeq) ?? "0",
      title,
      orderingOrganization,
      demandOrganization: toNullableText(row.demandOrganization),
      registeredAt,
      bidStartedAt: parseKstDate(row.bidStartedAt),
      bidEndedAt: parseKstDate(row.bidEndedAt),
      openedAt: parseKstDate(row.openedAt),
      region: toNullableText(row.region),
      procurementType: this.mapProcurementType(row.procurementType),
      contractMethod: toNullableText(row.contractMethod),
      estimatedAmount: toNullableText(row.estimatedAmount),
      sourceUrl,
      itemName: toNullableText(row.itemName) ?? "",
      description: toNullableText(row.description) ?? "",
      attachmentNames: [],
      licenseLimits: [],
      // KEPCO has no separate G2B license-limit enrichment requirement.
      licenseLimitsVerified: true,
      rawData: row,
    };
  }

  private mapProcurementType(value: unknown): ProcurementType {
    switch (toNullableText(value)?.toUpperCase()) {
      case ProcurementType.GOODS:
        return ProcurementType.GOODS;
      case ProcurementType.CONSTRUCTION:
        return ProcurementType.CONSTRUCTION;
      case ProcurementType.SERVICE:
        return ProcurementType.SERVICE;
      default:
        return ProcurementType.OTHER;
    }
  }
}

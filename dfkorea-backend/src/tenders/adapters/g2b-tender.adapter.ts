import { NormalizedTender } from "../domain/normalized-tender";
import {
  TenderOperationFailure,
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
  formatKstDateTimeMinute,
  parseKstDate,
  TenderApiClient,
  TenderSourceError,
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

  async fetchNotices(
    window: TenderFetchWindow,
  ): Promise<TenderSourceFetchResult> {
    const notices: NormalizedTender[] = [];
    const failures: TenderOperationFailure[] = [];

    for (const [operation, procurementType] of G2B_OPERATIONS) {
      try {
        const rows = await this.client.getAllPages({
          source: this.source,
          baseUrl: this.config.baseUrl,
          operation,
          query: {
            serviceKey: this.config.serviceKey,
            type: "json",
            inqryDiv: "1",
            inqryBgnDt: formatKstDateTimeMinute(window.from),
            inqryEndDt: formatKstDateTimeMinute(window.to),
          },
        });

        notices.push(
          ...rows.flatMap((row) => {
            const normalized = this.normalize(row, procurementType);
            return normalized ? [normalized] : [];
          }),
        );
      } catch (error) {
        failures.push(this.toOperationFailure(operation, error));
      }
    }

    const status =
      failures.length === 0
        ? SyncRunStatus.SUCCEEDED
        : notices.length > 0
          ? SyncRunStatus.PARTIAL
          : SyncRunStatus.FAILED;

    return {
      notices,
      status,
      errorCode:
        status === SyncRunStatus.PARTIAL
          ? "PARTIAL_PROVIDER_FAILURE"
          : status === SyncRunStatus.FAILED
            ? (failures[0]?.errorCode ?? "COLLECTION_ERROR")
            : null,
      failures,
    };
  }

  private toOperationFailure(
    operation: string,
    error: unknown,
  ): TenderOperationFailure {
    if (error instanceof TenderSourceError) {
      return {
        operation: error.operation ?? operation,
        errorCode: error.code,
        pageNo: error.pageNo,
        providerResultCode: error.providerResultCode,
        httpStatus: error.status,
        attempts: error.attempts,
      };
    }

    return {
      operation,
      errorCode: "COLLECTION_ERROR",
      pageNo: null,
      providerResultCode: null,
      httpStatus: null,
      attempts: 1,
    };
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
      rawData: row,
    };
  }
}

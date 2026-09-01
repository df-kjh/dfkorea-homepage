import {
  NormalizedTender,
  TenderLicenseLimit,
} from "../domain/normalized-tender";
import {
  LICENSE_LIMIT_UNAVAILABLE_ERROR_CODE,
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
const LICENSE_LIMIT_OPERATION = "getBidPblancListInfoLicenseLimit";
const PER_SECOND_LIMIT_RESULT_CODE = "23";
const PER_SECOND_LIMIT_RETRY_DELAY_MS = 1_100;

export class G2bTenderAdapter implements TenderSourceAdapter {
  readonly source = TenderSource.G2B;

  constructor(
    private readonly client: TenderApiClient,
    private readonly config: G2bTenderAdapterConfig,
  ) {}

  async fetchNotices(
    window: TenderFetchWindow,
  ): Promise<TenderSourceFetchResult> {
    const query = {
      serviceKey: this.config.serviceKey,
      type: "json",
      inqryDiv: "1",
      inqryBgnDt: formatKstDateTimeMinute(window.from),
      inqryEndDt: formatKstDateTimeMinute(window.to),
    };
    // The three base operations were already stable in production. Waiting
    // for them before license enrichment prevents the new fourth request from
    // crossing the provider's per-second gateway limit as one parallel burst.
    const collections = await Promise.all(
      G2B_OPERATIONS.map(async ([operation, procurementType]) => {
        const rows = await this.fetchOperation(operation, query);

        return rows.flatMap((row) => {
          const normalized = this.normalize(row, procurementType);
          return normalized ? [normalized] : [];
        });
      }),
    );
    const licenseLimitResult = await this.fetchOperation(
      LICENSE_LIMIT_OPERATION,
      query,
    )
      .then((rows) => ({
        rows,
        status: SyncRunStatus.SUCCEEDED as const,
        errorCode: null,
      }))
      .catch(() => ({
        rows: [] as Record<string, unknown>[],
        status: SyncRunStatus.PARTIAL as const,
        errorCode: LICENSE_LIMIT_UNAVAILABLE_ERROR_CODE,
      }));
    const licenseLimitsByNotice = this.groupLicenseLimits(
      licenseLimitResult.rows,
    );
    const licenseLimitsVerified =
      licenseLimitResult.status === SyncRunStatus.SUCCEEDED;

    return {
      notices: collections.flat().map((notice) => ({
        ...notice,
        licenseLimits:
          licenseLimitsByNotice.get(
            this.toNoticeKey(notice.sourceNoticeId, notice.revision),
          ) ?? [],
        licenseLimitsVerified,
      })),
      status: licenseLimitResult.status,
      errorCode: licenseLimitResult.errorCode,
    };
  }

  private async fetchOperation(
    operation: string,
    query: Record<string, string>,
  ): Promise<Record<string, unknown>[]> {
    const request = {
      source: this.source,
      baseUrl: this.config.baseUrl,
      operation,
      query,
    };

    try {
      return await this.client.getAllPages(request);
    } catch (error) {
      if (
        !(error instanceof TenderSourceError) ||
        error.providerResultCode !== PER_SECOND_LIMIT_RESULT_CODE
      ) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, PER_SECOND_LIMIT_RETRY_DELAY_MS),
      );
      return this.client.getAllPages(request);
    }
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
      licenseLimitsVerified: false,
      rawData: row,
    };
  }
}

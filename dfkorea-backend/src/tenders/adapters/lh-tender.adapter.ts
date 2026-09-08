import { NormalizedTender } from "../domain/normalized-tender";
import {
  TenderFetchWindow,
  TenderOperationFailure,
  TenderSourceAdapter,
  TenderSourceFetchResult,
} from "../domain/tender-source.adapter";
import {
  ProcurementType,
  SyncRunStatus,
  TenderSource,
} from "../domain/tender.enums";
import {
  LhHtmlClient,
  LhHtmlRequest,
  TenderSourceError,
} from "./public-api-client";
import {
  LhHtmlStructureError,
  LhListRow,
  parseLhListPage,
  parseLhTenderDetail,
} from "./lh-html";

export interface LhTenderAdapterConfig {
  enabled: boolean;
  baseUrl: string;
  requestIntervalMs: number;
  maximumPages?: number;
  maximumDetails?: number;
}

const LIST_PATH = "/ebid.et.tp.cmd.BidMasterListCmd.dev";
const LH_WORK_TYPES = ["30", "40"] as const;
const DEFAULT_MAXIMUM_PAGES = 50;
const DEFAULT_MAXIMUM_DETAILS = 200;
const LIGHTING_TITLE = /(?:\bled\b|조명|등기구|가로등|보안등)/i;

/**
 * Reads public LH pages one at a time. List candidates are narrowed before
 * detail requests, while TenderClassifier remains the final relevance gate.
 */
export class LhTenderAdapter implements TenderSourceAdapter {
  readonly source = TenderSource.LH;
  private readonly maximumPages: number;
  private readonly maximumDetails: number;
  private readonly requestIntervalMs: number;

  constructor(
    private readonly client: LhHtmlClient,
    private readonly config: LhTenderAdapterConfig,
  ) {
    if (config.enabled && !this.hasLhBaseUrl(config.baseUrl)) {
      throw new TenderSourceError(this.source, "CONFIGURATION_ERROR");
    }
    this.maximumPages = this.positiveLimit(
      config.maximumPages,
      DEFAULT_MAXIMUM_PAGES,
    );
    this.maximumDetails = this.positiveLimit(
      config.maximumDetails,
      DEFAULT_MAXIMUM_DETAILS,
    );
    this.requestIntervalMs = Number.isFinite(config.requestIntervalMs)
      ? Math.max(0, config.requestIntervalMs)
      : 1_500;
  }

  async fetchNotices(
    window: TenderFetchWindow,
  ): Promise<TenderSourceFetchResult> {
    if (!this.config.enabled) {
      return this.result([], []);
    }

    const failures: TenderOperationFailure[] = [];
    const candidates = new Map<string, LhListRow>();
    let successfulListOperations = 0;

    for (const workTypeCode of LH_WORK_TYPES) {
      try {
        const rows = await this.collectList(workTypeCode, window);
        successfulListOperations += 1;
        for (const row of rows) {
          const identity = `${row.sourceNoticeId}:${row.revision}`;
          if (LIGHTING_TITLE.test(row.title) && !candidates.has(identity)) {
            candidates.set(identity, row);
          }
        }
      } catch (error) {
        failures.push(this.toOperationFailure(`list:${workTypeCode}`, error));
      }
    }

    const notices: NormalizedTender[] = [];
    let requestedDetails = 0;
    for (const candidate of candidates.values()) {
      if (requestedDetails >= this.maximumDetails) {
        failures.push(this.limitFailure("detail", "DETAIL_LIMIT"));
        break;
      }
      requestedDetails += 1;
      try {
        const detailHtml = await this.request({
          source: this.source,
          operation: "detail",
          baseUrl: this.config.baseUrl,
          path: candidate.detailPath,
          method: "GET",
        });
        notices.push(
          this.normalize(
            candidate,
            parseLhTenderDetail(detailHtml, candidate.sourceNoticeId),
          ),
        );
      } catch (error) {
        failures.push(this.toOperationFailure("detail", error));
      }
    }

    return this.result(notices, failures, successfulListOperations);
  }

  private async collectList(
    workTypeCode: (typeof LH_WORK_TYPES)[number],
    window: TenderFetchWindow,
  ): Promise<LhListRow[]> {
    const rows: LhListRow[] = [];
    let targetRow = "1";
    for (let pageNo = 1; pageNo <= this.maximumPages; pageNo += 1) {
      const html = await this.request({
        source: this.source,
        operation: "list",
        baseUrl: this.config.baseUrl,
        path: LIST_PATH,
        method: "POST",
        form: {
          s_cstrtnJobGbCd: workTypeCode,
          s_bidnm: "",
          s_tndrdocAcptOpenDtm: this.formatDate(this.addDays(window.to, -7)),
          s_tndrdocAcptEndDtm: this.formatDate(this.addDays(window.to, 180)),
          targetRow,
          pageSpec: "default",
          devonOrderBy: "",
        },
      });
      const page = parseLhListPage(html, workTypeCode);
      rows.push(...page.rows);
      if (page.nextTargetRow === null) return rows;
      targetRow = page.nextTargetRow;
    }
    throw new TenderSourceError(
      this.source,
      "PAGINATION_LIMIT",
      null,
      undefined,
      `list:${workTypeCode}`,
      this.maximumPages,
    );
  }

  private normalize(
    row: LhListRow,
    detail: ReturnType<typeof parseLhTenderDetail>,
  ): NormalizedTender {
    return {
      source: this.source,
      sourceNoticeId: row.sourceNoticeId,
      revision: row.revision,
      title: row.title,
      orderingOrganization: detail.orderingOrganization,
      demandOrganization: detail.demandOrganization,
      registeredAt: detail.registeredAt,
      bidStartedAt: detail.bidStartedAt,
      bidEndedAt: detail.bidEndedAt,
      openedAt: detail.openedAt,
      region: detail.region,
      procurementType: ProcurementType.GOODS,
      contractMethod: detail.contractMethod,
      estimatedAmount: detail.basisAmount,
      sourceUrl: new URL(row.detailPath, this.config.baseUrl).toString(),
      itemName: row.title,
      description: "",
      attachmentNames: detail.attachments.map(
        (attachment) => attachment.displayName,
      ),
      rawData: {
        lh: {
          workTypeCode: row.workTypeCode,
          emergencyOrder: row.emergencyOrder,
          detailPath: row.detailPath,
          basisAmount: detail.basisAmount,
          attachments: detail.attachments,
        },
      },
    };
  }

  private async request(request: LhHtmlRequest): Promise<string> {
    try {
      return await this.client.request(request);
    } finally {
      if (this.requestIntervalMs > 0) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, this.requestIntervalMs),
        );
      }
    }
  }

  private result(
    notices: NormalizedTender[],
    failures: TenderOperationFailure[],
    successfulListOperations: number = LH_WORK_TYPES.length,
  ): TenderSourceFetchResult {
    const status =
      failures.length === 0
        ? SyncRunStatus.SUCCEEDED
        : successfulListOperations > 0 ||
            failures.some(
              (failure) =>
                failure.errorCode === "PAGINATION_LIMIT" ||
                failure.errorCode === "DETAIL_LIMIT",
            )
          ? SyncRunStatus.PARTIAL
          : SyncRunStatus.FAILED;
    return {
      notices,
      status,
      errorCode:
        status === SyncRunStatus.SUCCEEDED
          ? null
          : status === SyncRunStatus.PARTIAL
            ? "PARTIAL_PROVIDER_FAILURE"
            : (failures[0]?.errorCode ?? "COLLECTION_ERROR"),
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
      errorCode:
        error instanceof LhHtmlStructureError
          ? "STRUCTURE_CHANGED"
          : "COLLECTION_ERROR",
      pageNo: null,
      providerResultCode: null,
      httpStatus: null,
      attempts: 1,
    };
  }

  private limitFailure(
    operation: string,
    errorCode: string,
  ): TenderOperationFailure {
    return {
      operation,
      errorCode,
      pageNo: null,
      providerResultCode: null,
      httpStatus: null,
      attempts: 1,
    };
  }

  private hasLhBaseUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "ebid.lh.or.kr";
    } catch {
      return false;
    }
  }

  private positiveLimit(value: number | undefined, fallback: number): number {
    return Number.isSafeInteger(value) && value !== undefined && value > 0
      ? value
      : fallback;
  }

  private addDays(value: Date, days: number): Date {
    return new Date(value.getTime() + days * 24 * 60 * 60 * 1_000);
  }

  private formatDate(value: Date): string {
    const kst = new Date(value.getTime() + 9 * 60 * 60 * 1_000);
    return `${kst.getUTCFullYear()}/${String(kst.getUTCMonth() + 1).padStart(2, "0")}/${String(kst.getUTCDate()).padStart(2, "0")}`;
  }
}

import { NormalizedTender } from "../domain/normalized-tender";
import {
  emptyTenderEnrichment,
  EvidenceRef,
  TenderDocumentFormat,
  TenderEnrichment,
  TenderEnrichmentAdapter,
  TenderEnrichmentError,
  TenderEnrichmentOperationFailure,
  TenderLawKind,
} from "../domain/tender-enrichment";
import { ProcurementType, TenderSource } from "../domain/tender.enums";
import {
  TenderApiClient,
  TenderSourceError,
  toNullableText,
} from "./public-api-client";

export interface G2bEnrichmentAdapterConfig {
  baseUrl: string;
  serviceKey: string;
}

const OPERATIONS = [
  "getBidPblancListInfoThng",
  "getBidPblancListInfoThngBsisAmount",
  "getBidPblancListInfoLicenseLimit",
  "getBidPblancListInfoPrtcptPsblRgn",
  "getBidPblancListInfoThngPurchsObjPrdct",
] as const;

type Operation = (typeof OPERATIONS)[number];

const OPERATIONS_WITH_REVISION = new Set<Operation>([
  "getBidPblancListInfoLicenseLimit",
  "getBidPblancListInfoPrtcptPsblRgn",
  "getBidPblancListInfoThngPurchsObjPrdct",
]);

const REGION_CODES: Readonly<Record<string, string>> = {
  서울특별시: "11",
  부산광역시: "26",
  대구광역시: "27",
  인천광역시: "28",
  광주광역시: "29",
  대전광역시: "30",
  울산광역시: "31",
  세종특별자치시: "36",
  경기도: "41",
  충청북도: "43",
  충청남도: "44",
  전라북도: "45",
  전북특별자치도: "45",
  전라남도: "46",
  경상북도: "47",
  경상남도: "48",
  제주특별자치도: "50",
  강원도: "51",
  강원특별자치도: "51",
};

const evidence = (operation: Operation, field: string): EvidenceRef => ({
  source: "G2B_API",
  operation,
  field,
});

const formatFromName = (name: string): TenderDocumentFormat | null => {
  const match = /\.([a-z0-9]+)(?:$|[?#])/i.exec(name);
  const extension = match?.[1]?.toUpperCase();
  return extension === "PDF" ||
    extension === "HWP" ||
    extension === "HWPX" ||
    extension === "DOCX" ||
    extension === "XLSX"
    ? extension
    : null;
};

const lawKind = (row: Record<string, unknown>): TenderLawKind | null => {
  const code = toNullableText(row.applcnLawDivCd);
  const name = toNullableText(row.applcnLawNm);
  if (code === "1" || name?.includes("국가")) return "NATIONAL";
  if (code === "2" || name?.includes("지방")) return "LOCAL";
  return code || name ? "OTHER" : null;
};

export class G2bEnrichmentAdapter implements TenderEnrichmentAdapter {
  constructor(
    private readonly client: TenderApiClient,
    private readonly config: G2bEnrichmentAdapterConfig,
  ) {}

  async enrich(
    tender: NormalizedTender,
    signal: AbortSignal,
  ): Promise<TenderEnrichment> {
    if (tender.source !== TenderSource.G2B) {
      throw new TenderEnrichmentError("ENRICHMENT_SOURCE_MISMATCH");
    }
    if (tender.procurementType !== ProcurementType.GOODS) {
      throw new TenderEnrichmentError("ENRICHMENT_UNSUPPORTED_TYPE");
    }

    const rows = new Map<Operation, Record<string, unknown>[]>();
    const failures: TenderEnrichmentOperationFailure[] = [];
    for (const operation of OPERATIONS) {
      try {
        const query: Record<string, string> = {
          serviceKey: this.config.serviceKey,
          type: "json",
          inqryDiv: "2",
          bidNtceNo: tender.sourceNoticeId,
        };
        if (OPERATIONS_WITH_REVISION.has(operation)) {
          query.bidNtceOrd = tender.revision;
        }
        rows.set(
          operation,
          await this.client.getAllPages({
            source: TenderSource.G2B,
            baseUrl: this.config.baseUrl,
            operation,
            query,
            signal,
          }),
        );
      } catch (error) {
        failures.push(this.toFailure(operation, error));
      }
    }

    const result = emptyTenderEnrichment();
    result.failures = failures;
    this.readDetail(rows.get("getBidPblancListInfoThng") ?? [], tender, result);
    this.readBasis(
      rows.get("getBidPblancListInfoThngBsisAmount") ?? [],
      tender,
      result,
    );
    this.readLicenses(
      this.matchingRows(
        rows.get("getBidPblancListInfoLicenseLimit") ?? [],
        tender,
      ),
      result,
    );
    this.readRegions(
      this.matchingRows(
        rows.get("getBidPblancListInfoPrtcptPsblRgn") ?? [],
        tender,
      ),
      result,
    );
    this.readPurchaseItems(
      this.matchingRows(
        rows.get("getBidPblancListInfoThngPurchsObjPrdct") ?? [],
        tender,
      ),
      result,
    );
    return result;
  }

  private readDetail(
    rows: Record<string, unknown>[],
    tender: NormalizedTender,
    result: TenderEnrichment,
  ): void {
    const operation = "getBidPblancListInfoThng";
    const row = this.matchingRow(rows, tender);
    if (!row) return;

    const lowerLimitRate = toNullableText(
      row.sucsfbidLwltRate ?? row.sucsfbidLwltRateText,
    );
    if (lowerLimitRate) {
      result.lowerLimitRate = {
        value: lowerLimitRate,
        evidence: evidence(operation, "sucsfbidLwltRate"),
      };
    }
    const normalizedLawKind = lawKind(row);
    if (normalizedLawKind) {
      result.lawKind = {
        value: normalizedLawKind,
        evidence: evidence(operation, "applcnLawDivCd"),
      };
    }

    this.addFormulaVariable(
      result,
      operation,
      row,
      "reservePriceMethod",
      "rsrvtnPrceReMkngMthdNm",
    );
    this.addFormulaVariable(
      result,
      operation,
      row,
      "plannedPriceMethod",
      "prearngPrceDcsnMthdNm",
    );

    for (let index = 1; index <= 10; index += 1) {
      const url = toNullableText(row[`ntceSpecDocUrl${index}`]);
      if (!url) continue;
      const displayName =
        toNullableText(row[`ntceSpecFileNm${index}`]) ?? `첨부문서 ${index}`;
      result.documents.push({
        identity: `G2B:${tender.sourceNoticeId}:${tender.revision}:${index}`,
        url,
        displayName,
        formatHint: formatFromName(displayName) ?? formatFromName(url),
        source: "G2B_API",
        sourceNoticeId: tender.sourceNoticeId,
        revision: tender.revision,
        evidence: evidence(operation, `ntceSpecDocUrl${index}`),
      });
    }
  }

  private readBasis(
    rows: Record<string, unknown>[],
    tender: NormalizedTender,
    result: TenderEnrichment,
  ): void {
    const operation = "getBidPblancListInfoThngBsisAmount";
    const row = this.matchingRow(rows, tender);
    if (!row) return;
    const amount = toNullableText(row.bssamt);
    if (amount) {
      result.basisAmount = {
        value: amount,
        evidence: evidence(operation, "bssamt"),
      };
    }
    this.addFormulaVariable(
      result,
      operation,
      row,
      "reservePriceMinimumRate",
      "rsrvtnPrceRngBgnRate",
    );
    this.addFormulaVariable(
      result,
      operation,
      row,
      "reservePriceMaximumRate",
      "rsrvtnPrceRngEndRate",
    );
    this.addFormulaVariable(
      result,
      operation,
      row,
      "evaluationBasisAmount",
      "evlBssAmt",
    );
  }

  private readLicenses(
    rows: Record<string, unknown>[],
    result: TenderEnrichment,
  ): void {
    const operation = "getBidPblancListInfoLicenseLimit";
    result.licenses = rows.flatMap((row) => {
      const industryList = toNullableText(row.permsnIndstrytyList);
      const code =
        toNullableText(row.licenseCd ?? row.indstrytyCd) ??
        /(?:^|\D)(\d{4,})(?:\D|$)/.exec(industryList ?? "")?.[1] ??
        null;
      const name = toNullableText(
        row.lcnsLmtNm ?? row.licenseNm ?? row.indstrytyNm,
      );
      return code && name
        ? [
            {
              code,
              name,
              required: true,
              evidence: evidence(
                operation,
                row.permsnIndstrytyList === undefined
                  ? row.licenseCd === undefined
                    ? "indstrytyCd"
                    : "licenseCd"
                  : "permsnIndstrytyList",
              ),
            },
          ]
        : [];
    });
  }

  private readRegions(
    rows: Record<string, unknown>[],
    result: TenderEnrichment,
  ): void {
    const operation = "getBidPblancListInfoPrtcptPsblRgn";
    result.regions = rows.flatMap((row) => {
      const name = toNullableText(row.prtcptPsblRgnNm);
      const code =
        toNullableText(row.prtcptPsblRgnCd) ??
        (name ? this.regionCode(name) : null);
      return code && name
        ? [
            {
              code,
              name,
              required: true,
              evidence: evidence(
                operation,
                row.prtcptPsblRgnCd === undefined
                  ? "prtcptPsblRgnNm"
                  : "prtcptPsblRgnCd",
              ),
            },
          ]
        : [];
    });
  }

  private readPurchaseItems(
    rows: Record<string, unknown>[],
    result: TenderEnrichment,
  ): void {
    const operation = "getBidPblancListInfoThngPurchsObjPrdct";
    result.purchaseItems = rows.flatMap((row) => {
      const classificationCode = toNullableText(
        row.prdctClsfcNo ?? row.dtilPrdctClsfcNo,
      );
      const name = toNullableText(row.prdctClsfcNoNm ?? row.dtilPrdctClsfcNoNm);
      return classificationCode && name
        ? [
            {
              classificationCode,
              name,
              specification: toNullableText(row.prdctSpecNm),
              quantity: toNullableText(row.qty ?? row.prdctQty),
              unit: toNullableText(row.unit ?? row.prdctUnit),
              evidence: evidence(operation, "prdctClsfcNo"),
            },
          ]
        : [];
    });
  }

  private toFailure(
    operation: Operation,
    error: unknown,
  ): TenderEnrichmentOperationFailure {
    if (error instanceof TenderSourceError) {
      return {
        operation,
        errorCode: error.code,
        pageNo: error.pageNo,
        providerResultCode: error.providerResultCode,
        httpStatus: error.status,
        attempts: error.attempts,
      };
    }
    return {
      operation,
      errorCode: "ENRICHMENT_ERROR",
      pageNo: null,
      providerResultCode: null,
      httpStatus: null,
      attempts: 1,
    };
  }

  private matchingRow(
    rows: Record<string, unknown>[],
    tender: NormalizedTender,
  ): Record<string, unknown> | undefined {
    return rows.find(
      (row) =>
        toNullableText(row.bidNtceNo) === tender.sourceNoticeId &&
        toNullableText(row.bidNtceOrd) === tender.revision,
    );
  }

  private matchingRows(
    rows: Record<string, unknown>[],
    tender: NormalizedTender,
  ): Record<string, unknown>[] {
    return rows.filter(
      (row) =>
        toNullableText(row.bidNtceNo) === tender.sourceNoticeId &&
        toNullableText(row.bidNtceOrd) === tender.revision,
    );
  }

  private regionCode(name: string): string | null {
    const matchedName = Object.keys(REGION_CODES).find(
      (regionName) => name === regionName || name.startsWith(`${regionName} `),
    );
    return matchedName ? REGION_CODES[matchedName]! : null;
  }

  private addFormulaVariable(
    result: TenderEnrichment,
    operation: Operation,
    row: Record<string, unknown>,
    key: string,
    field: string,
  ): void {
    const value = toNullableText(row[field]);
    if (value) {
      result.formulaVariables.push({
        key,
        value,
        evidence: evidence(operation, field),
      });
    }
  }
}

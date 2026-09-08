import { NormalizedTender } from "../domain/normalized-tender";
import {
  emptyTenderEnrichment,
  issueTenderDocumentReference,
  TenderDocumentFormat,
  TenderDocumentReference,
  TenderEnrichment,
  TenderEnrichmentAdapter,
  TenderEnrichmentError,
} from "../domain/tender-enrichment";
import { ProcurementType, TenderSource } from "../domain/tender.enums";

const LH_DOWNLOAD_URL =
  "https://ebid.lh.or.kr/ebid.framework.download.dev";
const DETAIL_PATHS = {
  "30": "/ebid.et.tp.cmd.BidgdsDetailListCmd.dev",
  "40": "/ebid.et.tp.cmd.BidctrctgdsDetailListCmd.dev",
} as const;
const MAX_METADATA_TEXT = 512;

interface LhAttachmentMetadata {
  sequence: string;
  displayName: string;
  savedName: string;
}

interface LhMetadata {
  workTypeCode: keyof typeof DETAIL_PATHS;
  emergencyOrder: "N" | "Y";
  detailPath: string;
  basisAmount: string | null;
  attachments: LhAttachmentMetadata[];
}

const formatFromName = (name: string): TenderDocumentFormat | null => {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toUpperCase();
  return extension === "PDF" ||
    extension === "HWP" ||
    extension === "HWPX" ||
    extension === "DOCX" ||
    extension === "XLSX" ||
    extension === "ZIP"
    ? extension
    : null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

const isBoundedText = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= MAX_METADATA_TEXT &&
  !/[\0\r\n]/.test(value);

export class LhEnrichmentAdapter implements TenderEnrichmentAdapter {
  async enrich(
    tender: NormalizedTender,
    _signal: AbortSignal,
  ): Promise<TenderEnrichment> {
    if (tender.source !== TenderSource.LH) {
      throw new TenderEnrichmentError("ENRICHMENT_SOURCE_MISMATCH");
    }
    if (tender.procurementType !== ProcurementType.GOODS) {
      throw new TenderEnrichmentError("ENRICHMENT_UNSUPPORTED_TYPE");
    }

    const metadata = this.metadata(tender);
    this.validateDetailIdentity(tender, metadata);
    const result = emptyTenderEnrichment();
    if (metadata.basisAmount !== null) {
      result.basisAmount = {
        value: metadata.basisAmount,
        evidence: {
          source: "LH_PAGE",
          operation: "LH_NOTICE_DETAIL",
          field: "basisAmount",
        },
      };
    }
    result.documents = metadata.attachments.map((attachment) =>
      this.document(tender, attachment),
    );
    return result;
  }

  private metadata(tender: NormalizedTender): LhMetadata {
    const value = tender.rawData.lh;
    if (
      !isPlainObject(value) ||
      (value.workTypeCode !== "30" && value.workTypeCode !== "40") ||
      (value.emergencyOrder !== "N" && value.emergencyOrder !== "Y") ||
      !isBoundedText(value.detailPath) ||
      (value.basisAmount !== null &&
        (typeof value.basisAmount !== "string" ||
          !/^(?:0|[1-9]\d*)$/.test(value.basisAmount))) ||
      !Array.isArray(value.attachments)
    ) {
      throw new TenderEnrichmentError("ENRICHMENT_INVALID_METADATA");
    }

    const attachments: LhAttachmentMetadata[] = [];
    const sequences = new Set<string>();
    for (const attachment of value.attachments) {
      if (
        !isPlainObject(attachment) ||
        typeof attachment.sequence !== "string" ||
        !/^[1-9]\d{0,31}$/.test(attachment.sequence) ||
        sequences.has(attachment.sequence) ||
        !isBoundedText(attachment.displayName) ||
        !isBoundedText(attachment.savedName) ||
        /[\\/]/.test(attachment.savedName) ||
        attachment.savedName === "." ||
        attachment.savedName === ".."
      ) {
        throw new TenderEnrichmentError("ENRICHMENT_INVALID_METADATA");
      }
      sequences.add(attachment.sequence);
      attachments.push({
        sequence: attachment.sequence,
        displayName: attachment.displayName,
        savedName: attachment.savedName,
      });
    }
    return {
      workTypeCode: value.workTypeCode,
      emergencyOrder: value.emergencyOrder,
      detailPath: value.detailPath,
      basisAmount: value.basisAmount as string | null,
      attachments,
    };
  }

  private validateDetailIdentity(
    tender: NormalizedTender,
    metadata: LhMetadata,
  ): void {
    try {
      const url = new URL(metadata.detailPath, "https://ebid.lh.or.kr");
      const expectedKeys = new Set([
        "bidNum",
        "bidDegree",
        "cstrtnJobGbCd",
        "emrgncyOrder",
      ]);
      if (
        !metadata.detailPath.startsWith("/") ||
        url.origin !== "https://ebid.lh.or.kr" ||
        url.pathname !== DETAIL_PATHS[metadata.workTypeCode] ||
        url.hash ||
        [...url.searchParams.keys()].length !== expectedKeys.size ||
        [...url.searchParams.keys()].some(
          (key) =>
            !expectedKeys.has(key) || url.searchParams.getAll(key).length !== 1,
        ) ||
        url.searchParams.get("bidNum") !== tender.sourceNoticeId ||
        url.searchParams.get("bidDegree") !== tender.revision ||
        url.searchParams.get("cstrtnJobGbCd") !== metadata.workTypeCode ||
        url.searchParams.get("emrgncyOrder") !== metadata.emergencyOrder
      ) {
        throw new Error();
      }
    } catch {
      throw new TenderEnrichmentError("ENRICHMENT_NOTICE_MISMATCH");
    }
  }

  private document(
    tender: NormalizedTender,
    attachment: LhAttachmentMetadata,
  ): TenderDocumentReference {
    const url = new URL(LH_DOWNLOAD_URL);
    url.searchParams.set("noticeId", tender.sourceNoticeId);
    url.searchParams.set("revision", tender.revision);
    url.searchParams.set("sequence", attachment.sequence);
    url.searchParams.set("displayName", attachment.displayName);
    url.searchParams.set("savedName", attachment.savedName);
    return issueTenderDocumentReference({
      identity: `LH:${tender.sourceNoticeId}:${tender.revision}:${attachment.sequence}`,
      url: url.toString(),
      displayName: attachment.displayName,
      formatHint: formatFromName(attachment.displayName),
      source: "LH_PAGE",
      sourceNoticeId: tender.sourceNoticeId,
      revision: tender.revision,
      evidence: {
        source: "LH_PAGE",
        operation: "LH_NOTICE_DOCUMENTS",
        field: `attachment:${attachment.sequence}`,
      },
    });
  }
}

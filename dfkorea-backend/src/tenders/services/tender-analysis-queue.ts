import { analysisReviewSemantics } from "./tender-analysis-evidence";
import { EntityManager } from "typeorm";
import { Product } from "../../entities/product.entity";
import { fingerprint } from "../domain/tender-requirement";
import { TenderAnalysisStatus } from "../domain/tender-analysis.enums";
import { TenderAnalysis } from "../entities/tender-analysis.entity";
import { Tender } from "../entities/tender.entity";

export const TENDER_ANALYZER_VERSION = "rules-2";
export const pendingAnalysis = {
  status: TenderAnalysisStatus.PENDING,
  processingToken: null,
  leaseExpiresAt: null,
  errorCode: null,
};

export function tenderContentFingerprint(tender: Tender): string {
  // Collection timestamps and classifier scores are not analysis inputs. Hash
  // provider content for attachment/description changes, but never copy it into
  // an analysis or document row. Date instances need explicit serialization.
  return fingerprint({
    source: tender.source,
    sourceNoticeId: tender.sourceNoticeId,
    revision: tender.revision,
    title: tender.title,
    orderingOrganization: tender.orderingOrganization,
    demandOrganization: tender.demandOrganization,
    bidStartedAt: tender.bidStartedAt?.toISOString() ?? null,
    bidEndedAt: tender.bidEndedAt?.toISOString() ?? null,
    openedAt: tender.openedAt?.toISOString() ?? null,
    region: tender.region,
    procurementType: tender.procurementType,
    contractMethod: tender.contractMethod,
    estimatedAmount: tender.estimatedAmount,
    sourceUrl: tender.sourceUrl,
    content: tender.rawData,
  });
}

export function productCatalogFingerprint(
  products: Pick<Product, "id" | "updatedAt">[],
): string {
  return fingerprint(
    products
      .map((product) => ({
        id: product.id,
        updatedAt: product.updatedAt.toISOString(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export async function queueTenderAnalysis(
  manager: EntityManager,
  tender: Tender,
): Promise<void> {
  const repository = manager.getRepository(TenderAnalysis);
  const input = tenderContentFingerprint(tender);
  await repository
    .createQueryBuilder()
    .insert()
    .values({
      tenderId: tender.id,
      tenderFingerprint: input,
      analyzerVersion: TENDER_ANALYZER_VERSION,
      ...pendingAnalysis,
    })
    .orIgnore()
    .execute();
  await repository
    .createQueryBuilder()
    .update()
    .set({
      ...pendingAnalysis,
      tenderFingerprint: input,
      analyzerVersion: TENDER_ANALYZER_VERSION,
    })
    .where(
      '"tenderId" = :id AND ("tenderFingerprint" IS DISTINCT FROM :input OR "analyzerVersion" <> :version)',
      { id: tender.id, input, version: TENDER_ANALYZER_VERSION },
    )
    .execute();
}

export const analysisFingerprint = (analysis: TenderAnalysis): string =>
  fingerprint({
    tender: analysis.tenderFingerprint,
    documents: analysis.documentFingerprint,
    profile: analysis.companyProfileFingerprint,
    products: analysis.productCatalogFingerprint,
    version: analysis.analyzerVersion,
    // Re-running with refreshed award samples or newly expired qualifications
    // can change the reviewed decision even when stored source inputs match.
    result: {
      suitability: analysis.suitability,
      score: analysis.specificationScore,
      ...(analysisReviewSemantics(analysis) as Record<string, unknown>),
    },
  });

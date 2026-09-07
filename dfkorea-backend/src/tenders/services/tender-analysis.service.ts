import {
  boundedAnalysisDisplay,
  compactAnalysisDetail,
} from "./tender-analysis-detail";
import { TenderAwardResult } from "../entities/tender-award-result.entity";
import { monthlyAwardWindows } from "../domain/tender-award-window";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { Between, DataSource, EntityManager, In } from "typeorm";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Admin } from "../../entities/admin.entity";
import { Product } from "../../entities/product.entity";
import { Tender } from "../entities/tender.entity";
import { TenderAnalysis } from "../entities/tender-analysis.entity";
import { TenderAnalysisReview } from "../entities/tender-analysis-review.entity";
import { TenderDocument } from "../entities/tender-document.entity";
import { TenderCompanyProfile } from "../entities/tender-company-profile.entity";
import {
  TenderAnalysisStatus,
  TenderDocumentStatus,
  TenderSuitability,
  TenderRequirementState,
} from "../domain/tender-analysis.enums";
import { ProcurementType, TenderSource } from "../domain/tender.enums";
import {
  emptyTenderEnrichment,
  G2B_TENDER_ENRICHMENT_ADAPTER,
  KAPT_TENDER_ENRICHMENT_ADAPTER,
  TENDER_DOCUMENT_FETCHER,
  TenderDocumentFetcherContract,
  TenderEnrichmentAdapter,
} from "../domain/tender-enrichment";
import { TenderDocumentTextExtractor } from "../documents/tender-document-extractor";
import { TenderDocumentExtractionError } from "../documents/tender-document-extraction.types";
import { TenderRequirementParser } from "../domain/tender-requirement-parser";
import { TenderSuitabilityAnalyzer } from "../domain/tender-suitability-analyzer";
import {
  fingerprint,
  TenderRequirementDocument,
} from "../domain/tender-requirement";
import { TenderPriceAnalyzer } from "../domain/tender-price-analyzer";
import { TenderCompanyProfileService } from "./tender-company-profile.service";
import {
  SaveTenderAnalysisReviewDto,
  TenderAnalysisSummaryDto,
} from "../dto/tender-analysis.dto";
import {
  analysisFingerprint,
  pendingAnalysis,
  productCatalogFingerprint,
  queueTenderAnalysis,
  tenderContentFingerprint,
  TENDER_ANALYZER_VERSION,
} from "./tender-analysis-queue";

class AnalysisLeaseExpired extends Error {}

const finalStatuses = [
  TenderAnalysisStatus.COMPLETED,
  TenderAnalysisStatus.PARTIAL,
];
const productSelection = {
  id: true,
  updatedAt: true,
  dimensions: true,
  power: true,
  colorTemp: true,
  certifications: true,
  luminanceEfficiency: true,
  colorRendering: true,
} as const;

@Injectable()
export class TenderAnalysisService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(G2B_TENDER_ENRICHMENT_ADAPTER)
    private readonly g2b: TenderEnrichmentAdapter,
    @Inject(KAPT_TENDER_ENRICHMENT_ADAPTER)
    private readonly kapt: TenderEnrichmentAdapter,
    @Inject(TENDER_DOCUMENT_FETCHER)
    private readonly fetcher: TenderDocumentFetcherContract,
    private readonly extractor: TenderDocumentTextExtractor,
    private readonly profiles: TenderCompanyProfileService,
    private readonly prices: TenderPriceAnalyzer,
  ) {}

  async reanalyze(tenderId: string, _now: Date) {
    await this.db.transaction(async (manager) => {
      const tender = await this.requireTender(manager, tenderId, true);
      await queueTenderAnalysis(manager, tender);
      await manager
        .getRepository(TenderAnalysis)
        .update({ tenderId }, pendingAnalysis);
    });
    return this.getAnalysis(tenderId);
  }

  async refreshStaleAnalyses(
    now = new Date(),
  ): Promise<{ queuedCount: number }> {
    const products = await this.db
      .getRepository(Product)
      .find({ select: { id: true, updatedAt: true } });
    const catalog = productCatalogFingerprint(products);
    const result = await this.db
      .getRepository(TenderAnalysis)
      .createQueryBuilder()
      .update()
      .set(pendingAnalysis)
      .where(
        '("productCatalogFingerprint" IS DISTINCT FROM :catalog OR "analyzerVersion" <> :version OR "eligibilityValidUntil" <= :now) AND status <> :pending',
        {
          catalog,
          now,
          version: TENDER_ANALYZER_VERSION,
          pending: TenderAnalysisStatus.PENDING,
        },
      )
      .execute();
    return { queuedCount: result.affected ?? 0 };
  }

  async queueMissingAnalysesSince(
    since: Date,
    limit: number,
  ): Promise<{ queuedCount: number }> {
    const count = Number.isFinite(limit)
      ? Math.max(0, Math.min(50, Math.floor(limit)))
      : 0;
    if (count === 0) return { queuedCount: 0 };

    return this.db.transaction(async (manager) => {
      const analysisTable = manager
        .getRepository(TenderAnalysis)
        .metadata.tablePath.split(".")
        .map((part) => manager.connection.driver.escape(part))
        .join(".");
      // Analysis rows are the durable catch-up cursor. Lock only supported
      // tender rows so multiple app instances select disjoint bounded batches.
      const tenders = await manager
        .getRepository(Tender)
        .createQueryBuilder("tender")
        .where("tender.registeredAt >= :since", { since })
        .andWhere(
          "(tender.source = :kapt OR (tender.source = :g2b AND tender.procurementType = :goods))",
          {
            kapt: TenderSource.KAPT,
            g2b: TenderSource.G2B,
            goods: ProcurementType.GOODS,
          },
        )
        .andWhere(
          `NOT EXISTS (SELECT 1 FROM ${analysisTable} analysis WHERE analysis."tenderId" = tender.id)`,
        )
        .orderBy("tender.registeredAt", "ASC")
        .addOrderBy("tender.id", "ASC")
        .take(count)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();

      for (const tender of tenders) {
        await queueTenderAnalysis(manager, tender);
      }
      return { queuedCount: tenders.length };
    });
  }

  async processDue(now: Date, limit: number): Promise<{ processed: number }> {
    let processed = 0;
    const count = Number.isFinite(limit)
      ? Math.max(0, Math.min(5, Math.floor(limit)))
      : 0;
    // Claim just one row immediately before work; a queued batch must not spend
    // its five-minute lease waiting behind other document downloads.
    for (let i = 0; i < count; i++) {
      const claim = await this.db.transaction(async (manager) => {
        const repo = manager.getRepository(TenderAnalysis);
        const row = await repo
          .createQueryBuilder("analysis")
          .where(
            "analysis.status = :pending OR (analysis.status = :processing AND analysis.leaseExpiresAt <= clock_timestamp())",
            {
              pending: TenderAnalysisStatus.PENDING,
              processing: TenderAnalysisStatus.PROCESSING,
            },
          )
          .orderBy("analysis.updatedAt", "ASC")
          .addOrderBy("analysis.id", "ASC")
          .take(1)
          .setLock("pessimistic_write")
          .setOnLocked("skip_locked")
          .getOne();
        if (!row) return null;
        return repo.save({
          ...row,
          status: TenderAnalysisStatus.PROCESSING,
          processingToken: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 5 * 60_000),
        });
      });
      if (!claim) break;
      await this.processClaim(claim, now);
      processed++;
    }
    return { processed };
  }

  async getAnalysis(tenderId: string, now = new Date()) {
    await this.requireTender(this.db.manager, tenderId);
    const row = await this.db
      .getRepository(TenderAnalysis)
      .findOneBy({ tenderId });
    if (!row)
      return {
        tenderId,
        status: TenderAnalysisStatus.PENDING,
        reviewed: false,
        analysisFingerprint: null,
        documents: [],
        review: null,
        priceAnalysis: null,
      };
    const [documents, review] = await Promise.all([
      this.db.getRepository(TenderDocument).find({
        where: { tenderId },
        select: {
          id: true,
          sourceDocumentIdentity: true,
          displayName: true,
          format: true,
          status: true,
          errorCode: true,
          extractedAt: true,
        },
        order: { sourceDocumentIdentity: "ASC" },
      }),
      this.db.getRepository(TenderAnalysisReview).findOne({
        where: { tenderId },
        order: { createdAt: "DESC", id: "DESC" },
      }),
    ]);
    const currentFingerprint = analysisFingerprint(row);
    const detail = compactAnalysisDetail(row);
    return {
      id: row.id,
      tenderId,
      ...this.summary(row, now),
      analysisFingerprint: currentFingerprint,
      comparableCount: row.comparableRequirementCount,
      satisfiedCount: row.satisfiedRequirementCount,
      unsatisfiedCount: row.unsatisfiedRequirementCount,
      requirements: detail.requirements,
      certificationAnalysis: detail.certificationAnalysis,
      participationAnalysis: detail.participationAnalysis,
      priceAnalysis: detail.priceAnalysis,
      evidence: detail.evidence,
      errorCode:
        row.errorCode == null
          ? null
          : boundedAnalysisDisplay(row.errorCode, 128),
      documents: documents.slice(0, 10).map((document) => ({
        ...document,
        sourceDocumentIdentity: boundedAnalysisDisplay(
          document.sourceDocumentIdentity,
          256,
          true,
        ),
        displayName: boundedAnalysisDisplay(document.displayName),
        format:
          document.format == null
            ? null
            : boundedAnalysisDisplay(document.format, 32),
        errorCode:
          document.errorCode == null
            ? null
            : boundedAnalysisDisplay(document.errorCode, 128),
      })),
      reviewed:
        finalStatuses.includes(row.status) &&
        !this.analysisStale(row, now) &&
        review?.analysisFingerprint === currentFingerprint &&
        review.completed === true,
      review: review
        ? {
            completed: review.completed,
            note: review.note,
            reviewerAdminId: review.reviewerAdminId,
            reviewedAt: review.reviewedAt,
            analysisFingerprint: review.analysisFingerprint,
          }
        : null,
    };
  }

  async getSummaries(
    ids: string[],
    now = new Date(),
  ): Promise<Map<string, TenderAnalysisSummaryDto>> {
    if (!ids.length) return new Map();
    const rows = await this.db.getRepository(TenderAnalysis).find({
      where: { tenderId: In(ids) },
      select: {
        tenderId: true,
        status: true,
        suitability: true,
        specificationScore: true,
        unknownRequirementCount: true,
        analyzedAt: true,
        eligibilityValidUntil: true,
        analyzerVersion: true,
      },
    });
    return new Map(rows.map((row) => [row.tenderId, this.summary(row, now)]));
  }

  async resolveAdminId(username: string): Promise<number> {
    const admin =
      username &&
      (await this.db
        .getRepository(Admin)
        .findOne({ where: { username }, select: { id: true } }));
    if (!admin) throw new UnauthorizedException();
    return admin.id;
  }

  async saveReview(
    tenderId: string,
    input: SaveTenderAnalysisReviewDto,
    adminId: number,
  ) {
    const dto = plainToInstance(SaveTenderAnalysisReviewDto, input);
    if ((await validate(dto)).length)
      throw new BadRequestException("Invalid analysis review");
    if (!(await this.db.getRepository(Admin).existsBy({ id: adminId })))
      throw new UnauthorizedException();
    await this.db.transaction(async (manager) => {
      await this.requireTender(manager, tenderId);
      const row = await manager
        .getRepository(TenderAnalysis)
        .findOne({ where: { tenderId }, lock: { mode: "pessimistic_write" } });
      if (
        !row ||
        !finalStatuses.includes(row.status) ||
        this.analysisStale(row, new Date())
      )
        throw new ConflictException("Analysis is not ready for review");
      const currentFingerprint = analysisFingerprint(row);
      if (dto.analysisFingerprint !== currentFingerprint)
        throw new ConflictException(
          "Analysis changed; refresh before reviewing",
        );
      await manager.getRepository(TenderAnalysisReview).save({
        tenderId,
        analysisId: row.id,
        analysisFingerprint: currentFingerprint,
        completed: dto.completed,
        note: dto.note,
        reviewerAdminId: adminId,
        reviewedAt: new Date(),
      });
    });
    return this.getAnalysis(tenderId);
  }

  private analysisStale(row: TenderAnalysis, now: Date): boolean {
    return (
      row.analyzerVersion !== TENDER_ANALYZER_VERSION ||
      (row.eligibilityValidUntil != null &&
        row.eligibilityValidUntil.getTime() <= now.getTime())
    );
  }

  private summary(
    row: TenderAnalysis,
    now = new Date(),
  ): TenderAnalysisSummaryDto {
    const stale = this.analysisStale(row, now);
    return {
      status:
        stale && finalStatuses.includes(row.status)
          ? TenderAnalysisStatus.PENDING
          : row.status,
      suitability: stale ? null : row.suitability,
      specificationScore:
        row.specificationScore === null ? null : Number(row.specificationScore),
      unknownCount: row.unknownRequirementCount,
      analyzedAt: row.analyzedAt,
    };
  }

  private async requireTender(
    manager: EntityManager,
    id: string,
    lock = false,
  ): Promise<Tender> {
    const tender = await manager.getRepository(Tender).findOne({
      where: { id },
      ...(lock ? { lock: { mode: "pessimistic_read" as const } } : {}),
    });
    if (
      !tender ||
      (tender.source === TenderSource.G2B &&
        tender.procurementType !== ProcurementType.GOODS)
    )
      throw new NotFoundException("Tender not found");
    return tender;
  }

  private async processClaim(claim: TenderAnalysis, now: Date): Promise<void> {
    const tender = await this.requireTender(this.db.manager, claim.tenderId);
    const [profile, products] = await Promise.all([
      this.profiles.get(),
      this.db.getRepository(Product).find({ select: productSelection }),
    ]);
    const tenderInput = tenderContentFingerprint(tender);
    const profileInput = fingerprint(profile);
    const catalogInput = productCatalogFingerprint(products);
    let failed = false;
    let enrichment = emptyTenderEnrichment();
    try {
      const adapter =
        tender.source === TenderSource.G2B
          ? this.g2b
          : tender.source === TenderSource.KAPT
            ? this.kapt
            : null;
      if (!adapter) failed = true;
      else
        enrichment = await adapter.enrich(
          { ...tender, itemName: "", description: "", attachmentNames: [] },
          AbortSignal.timeout(120_000),
        );
    } catch {
      failed = true;
    }
    failed ||= enrichment.failures.length > 0;
    const documents: Partial<TenderDocument>[] = [];
    const extracted: TenderRequirementDocument[] = [];
    // A bounded job can revisit its references on manual retry. Never let one
    // corrupt source abort its siblings, nor treat cached failures as success.
    failed ||= enrichment.documents.length > 10;
    for (const reference of enrichment.documents.slice(0, 10)) {
      // Several independently bounded documents can outlast one lease. Renew
      // only an unexpired claim; a superseded worker may never revive itself.
      const renewed = await this.db.transaction(async (manager) => {
        const repository = manager.getRepository(TenderAnalysis);
        const row = await repository.findOne({
          where: {
            id: claim.id,
            processingToken: claim.processingToken,
            tenderFingerprint: claim.tenderFingerprint,
          },
          lock: { mode: "pessimistic_write" },
        });
        if (!row) return false;
        // Compare the fresh DB clock in a separate statement after any row
        // lock wait; an UPDATE predicate evaluated before waiting is too early.
        const update = await repository
          .createQueryBuilder()
          .update()
          .set({
            leaseExpiresAt: () => "clock_timestamp() + interval '5 minutes'",
          })
          .where(
            'id = :id AND "processingToken" = :token AND "tenderFingerprint" = :input AND "leaseExpiresAt" > clock_timestamp()',
            {
              id: claim.id,
              token: claim.processingToken,
              input: claim.tenderFingerprint,
            },
          )
          .execute();
        return update.affected === 1;
      });
      if (!renewed) return;
      const document: Partial<TenderDocument> = {
        tenderId: tender.id,
        sourceDocumentIdentity: boundedAnalysisDisplay(
          reference.identity,
          256,
          true,
        ),
        displayName: boundedAnalysisDisplay(reference.displayName),
        sourceUrl: reference.url,
        format: reference.formatHint,
        mimeType: null,
        contentHash: null,
        textBlocks: null,
        tableBlocks: null,
        extractionMetadata: null,
        extractedAt: now,
        status: TenderDocumentStatus.FAILED,
        errorCode: "DOCUMENT_FETCH_FAILED",
      };
      try {
        const fetched = await this.fetcher.fetch(
          reference,
          AbortSignal.timeout(15_000),
        );
        document.contentHash = fetched.sha256;
        document.format = fetched.detectedFormat;
        document.errorCode = "DOCUMENT_EXTRACTION_FAILED";
        const result = await this.extractor.extract(fetched);
        document.status =
          result.status === "PARTIAL"
            ? TenderDocumentStatus.PARTIAL
            : TenderDocumentStatus.EXTRACTED;
        document.errorCode =
          result.status === "PARTIAL" ? "DOCUMENT_PARTIAL" : null;
        document.textBlocks = result.blocks
          .filter((block) => block.kind === "text")
          .map((block) => ({ ...block }));
        document.tableBlocks = result.blocks
          .filter((block) => block.kind === "table")
          .map((block) => ({ ...block }));
        document.extractionMetadata = { ...result.metadata };
        extracted.push({
          ...result,
          identity: reference.identity,
          revision: reference.revision,
        });
        failed ||= result.status === "PARTIAL";
      } catch (error) {
        failed = true;
        if (error instanceof TenderDocumentExtractionError) {
          document.status =
            error.status === "UNSUPPORTED"
              ? TenderDocumentStatus.UNSUPPORTED
              : TenderDocumentStatus.FAILED;
          document.errorCode = error.code;
        }
      }
      documents.push(document);
    }
    let changes: Partial<TenderAnalysis>;
    try {
      const requirements = new TenderRequirementParser().parse(
        enrichment,
        extracted,
      );
      // An absent company profile is missing evidence, never a negative claim
      // about actual qualifications. Map affected evaluations to UNKNOWN.
      const productSnapshot = products.map((product) => ({
        id: product.id,
        dimensions: product.dimensions,
        power: product.power.map(Number),
        colorTemp: product.colorTemp.map(Number),
        certifications: product.certifications,
        ...(product.luminanceEfficiency != null
          ? { luminanceEfficiency: Number(product.luminanceEfficiency) }
          : {}),
        ...(product.colorRendering
          ? { colorRendering: product.colorRendering }
          : {}),
      }));
      const analyzer = new TenderSuitabilityAnalyzer();
      const result = analyzer.analyze(
        requirements,
        profile ?? {
          companyName: "",
          businessNumber: "",
          headquarters: { sido: "", sigungu: "" },
          g2bRegistered: false,
          supplyProducts: [],
          licenses: [],
          companyTypes: [],
          directProduction: [],
          certifications: [],
          performanceRecords: [],
          version: 0,
        },
        productSnapshot,
        now,
      );
      if (!profile) {
        for (const evaluation of [
          ...result.certifications,
          ...result.participationConditions,
        ]) {
          evaluation.state = TenderRequirementState.UNKNOWN;
        }
        result.suitability =
          result.unsatisfiedCount > 0 &&
          result.specificationScore !== null &&
          result.specificationScore < 50
            ? TenderSuitability.DIFFICULT
            : TenderSuitability.REVIEW;
      }
      const useful =
        requirements.items.some((item) => item.specifications.length) ||
        requirements.certifications.length > 0 ||
        requirements.participationConditions.length > 0 ||
        Object.keys(requirements.bidFormula).some(
          (key) => key !== "evidenceIds",
        ) ||
        extracted.some((document) => document.blocks.length > 0);
      // Only verified adapter facts permit matching stored awards. The G2B
      // adapter admits a narrow explicit total/KRW/standard declaration;
      // absent or ambiguous metadata still cannot enable calculation.
      const context = enrichment.pricingContext;
      const history =
        context?.contractKind === "TOTAL" &&
        context.currency === "KRW" &&
        context.awardMethod &&
        requirements.items.length === 1
          ? await this.db.getRepository(TenderAwardResult).find({
              where: {
                source: tender.source,
                awardMethod: context.awardMethod,
                isFinalAward: true,
                isFailedBid: false,
                openedAt: Between(
                  new Date(
                    `${monthlyAwardWindows(now)[0].start}T00:00:00+09:00`,
                  ),
                  now,
                ),
              },
            })
          : [];
      const price = this.prices.analyze(
        {
          ...requirements,
          pricingContext: {
            contractKind: "UNKNOWN",
            currency: "UNKNOWN",
            formulaKind: "UNKNOWN",
            ...context,
            source: tender.source === TenderSource.KAPT ? "KAPT" : "G2B",
            now,
          },
        },
        history,
      );
      changes = {
        eligibilityValidUntil: profile
          ? analyzer.nextValidityBoundary(
              requirements,
              profile,
              productSnapshot,
              now,
              result,
            )
          : null,
        status: failed
          ? useful
            ? TenderAnalysisStatus.PARTIAL
            : TenderAnalysisStatus.FAILED
          : TenderAnalysisStatus.COMPLETED,
        suitability:
          failed && result.suitability === TenderSuitability.RECOMMENDED
            ? TenderSuitability.REVIEW
            : result.suitability,
        specificationScore: result.specificationScore?.toFixed(2) ?? null,
        comparableRequirementCount: result.totalCount - result.unknownCount,
        satisfiedRequirementCount: result.satisfiedCount,
        unsatisfiedRequirementCount: result.unsatisfiedCount,
        unknownRequirementCount:
          result.unknownCount +
          [...result.certifications, ...result.participationConditions].filter(
            (value) => value.state === TenderRequirementState.UNKNOWN,
          ).length +
          result.evidence.filter((value) => value.state === "UNKNOWN").length +
          (profile ? 0 : 1) +
          (failed ? 1 : 0),
        requirements: requirements.items.map((item) => ({ ...item })),
        certificationAnalysis: {
          evaluations: result.certifications,
          requirements: requirements.certifications,
        },
        participationAnalysis: {
          evaluations: result.participationConditions,
          requirements: requirements.participationConditions,
          profileMissing: profile === null,
        },
        priceAnalysis: {
          ...price,
          basisAmount: requirements.bidFormula.basisAmount ?? null,
          lowerLimitRate: requirements.bidFormula.lowerLimitRate ?? null,
          formula: requirements.bidFormula,
        },
        evidence: result.evidence.map((value) => ({ ...value })),
        errorCode: failed ? "ANALYSIS_SOURCE_FAILURE" : null,
      };
    } catch {
      changes = {
        status: TenderAnalysisStatus.FAILED,
        eligibilityValidUntil: null,
        errorCode: "ANALYSIS_FAILED",
      };
    }
    changes = { ...changes, ...compactAnalysisDetail(changes) };
    await this.db
      .transaction(async (manager) => {
        // Match writer lock order (profile -> tender -> analysis). A brief table
        // SHARE lock also fences catalog INSERT/DELETE phantoms at final commit.
        const currentProfile = await manager
          .getRepository(TenderCompanyProfile)
          .findOne({
            where: { singletonKey: "company" },
            lock: { mode: "pessimistic_read" },
          });
        const table = manager
          .getRepository(Product)
          .metadata.tablePath.split(".")
          .map((part) => manager.connection.driver.escape(part))
          .join(".");
        await manager.query(`LOCK TABLE ${table} IN SHARE MODE`);
        const currentTender = await this.requireTender(
          manager,
          tender.id,
          true,
        );
        const row = await manager
          .getRepository(TenderAnalysis)
          .createQueryBuilder("analysis")
          .where(
            "analysis.id = :id AND analysis.processingToken = :token AND analysis.tenderFingerprint = :input AND analysis.leaseExpiresAt > clock_timestamp()",
            {
              id: claim.id,
              token: claim.processingToken,
              input: claim.tenderFingerprint,
            },
          )
          .setLock("pessimistic_write")
          .getOne();
        if (!row) return;
        const latestProducts = await manager
          .getRepository(Product)
          .find({ select: { id: true, updatedAt: true } });
        if (
          tenderContentFingerprint(currentTender) !== tenderInput ||
          tenderInput !== claim.tenderFingerprint ||
          (currentProfile?.version ?? null) !== (profile?.version ?? null) ||
          productCatalogFingerprint(latestProducts) !== catalogInput
        ) {
          await manager
            .getRepository(TenderAnalysis)
            .createQueryBuilder()
            .update()
            .set({
              ...pendingAnalysis,
              tenderFingerprint: tenderContentFingerprint(currentTender),
            })
            .where(
              'id = :id AND "processingToken" = :token AND "tenderFingerprint" = :input AND "leaseExpiresAt" > clock_timestamp()',
              {
                id: row.id,
                token: claim.processingToken,
                input: claim.tenderFingerprint,
              },
            )
            .execute();
          return;
        }
        const documentRepo = manager.getRepository(TenderDocument);
        await documentRepo.delete({ tenderId: tender.id });
        if (documents.length) await documentRepo.save(documents);
        const committed = await manager
          .getRepository(TenderAnalysis)
          .createQueryBuilder()
          .update()
          .set({
            ...changes,
            documentFingerprint: fingerprint(
              documents
                .map((document) => ({
                  identity: document.sourceDocumentIdentity,
                  hash: document.contentHash,
                  status: document.status,
                }))
                .sort((a, b) => a.identity.localeCompare(b.identity)),
            ),
            companyProfileFingerprint: profileInput,
            productCatalogFingerprint: catalogInput,
            analyzerVersion: TENDER_ANALYZER_VERSION,
            processingToken: null,
            leaseExpiresAt: null,
            analyzedAt: now,
          })
          .where(
            'id = :id AND "processingToken" = :token AND "tenderFingerprint" = :input AND "leaseExpiresAt" > clock_timestamp()',
            { id: row.id, token: claim.processingToken, input: tenderInput },
          )
          .execute();
        // This final CAS runs after catalog/row/document writes have finished
        // waiting. Throwing rolls back every document replacement if the lease
        // expired in between; an initial SELECT fence alone cannot do that.
        if (committed.affected !== 1) throw new AnalysisLeaseExpired();
      })
      .catch((error) => {
        if (!(error instanceof AnalysisLeaseExpired)) throw error;
      });
  }
}

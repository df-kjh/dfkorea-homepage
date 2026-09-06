import { FixTenderReviewAdminIdentity1788699100000 } from "../../migrations/1788699100000-FixTenderReviewAdminIdentity";
import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import { Product } from "../../entities/product.entity";
import { Admin } from "../../entities/admin.entity";
import { Tender } from "../entities/tender.entity";
import { TenderAnalysis } from "../entities/tender-analysis.entity";
import { TenderAnalysisReview } from "../entities/tender-analysis-review.entity";
import { TenderDocument } from "../entities/tender-document.entity";
import { TenderCompanyProfile } from "../entities/tender-company-profile.entity";
import { TenderAwardResult } from "../entities/tender-award-result.entity";
import { TenderCompanyProfileService } from "./tender-company-profile.service";
import { TenderAnalysisService } from "./tender-analysis.service";
import { TenderPriceAnalyzer } from "../domain/tender-price-analyzer";
import {
  emptyTenderEnrichment,
  TenderEnrichment,
} from "../domain/tender-enrichment";
import {
  ProcurementType,
  TenderRelevance,
  TenderSource,
} from "../domain/tender.enums";

const databaseUrl = process.env.TASK7_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;
postgres("analysis PostgreSQL leases and input invalidation", () => {
  let db: DataSource;
  let service: TenderAnalysisService;
  let tender: Tender;
  let enrichment: TenderEnrichment;
  let enrich: jest.Mock;
  let fetch: jest.Mock;
  let profile: TenderCompanyProfileService;
  const now = new Date();
  const schema = `analysis_test_${randomUUID().replace(/-/g, "")}`;
  const profileInput = {
    companyName: "test",
    businessNumber: "1234567890",
    headquarters: { sido: "경기도", sigungu: "화성시" },
    g2bRegistered: true,
    supplyProducts: [],
    licenses: [],
    companyTypes: [],
    directProduction: [],
    certifications: [],
    performanceRecords: [],
  };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.endsWith("_test")
    )
      throw new Error("Dedicated local *_test DB required");
    db = await new DataSource({
      type: "postgres",
      url: databaseUrl,
      schema,
      entities: [
        Tender,
        TenderAnalysis,
        TenderAnalysisReview,
        TenderDocument,
        TenderCompanyProfile,
        TenderAwardResult,
        Product,
        Admin,
      ],
    }).initialize();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.synchronize();
  });
  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });
  beforeEach(async () => {
    await db
      .getRepository(TenderAwardResult)
      .createQueryBuilder()
      .delete()
      .execute();
    await db
      .getRepository(TenderAnalysisReview)
      .createQueryBuilder()
      .delete()
      .execute();
    await db
      .getRepository(TenderDocument)
      .createQueryBuilder()
      .delete()
      .execute();
    await db
      .getRepository(TenderAnalysis)
      .createQueryBuilder()
      .delete()
      .execute();
    await db.getRepository(Tender).createQueryBuilder().delete().execute();
    await db
      .getRepository(TenderCompanyProfile)
      .createQueryBuilder()
      .delete()
      .execute();
    await db.getRepository(Product).createQueryBuilder().delete().execute();
    tender = await db.getRepository(Tender).save({
      source: TenderSource.G2B,
      sourceNoticeId: "fixture",
      revision: "000",
      title: "LED 등기구",
      orderingOrganization: "fixture",
      registeredAt: now,
      sourceUrl: "https://www.g2b.go.kr/",
      procurementType: ProcurementType.GOODS,
      relevance: TenderRelevance.DIRECT,
      relevanceScore: 100,
      relevanceReasons: [],
      rawData: {},
    });
    enrichment = emptyTenderEnrichment();
    enrichment.purchaseItems = [
      {
        classificationCode: "3911210201",
        name: "LED",
        specification: "소비전력 30W 이하",
        quantity: "1",
        unit: "개",
        evidence: { source: "G2B_API", operation: "fixture", field: "spec" },
      },
    ];
    enrich = jest.fn(async () => enrichment);
    fetch = jest.fn(async () => ({
      bytes: new Uint8Array([1]),
      detectedFormat: "DOCX",
      sha256: "a".repeat(64),
    }));
    profile = new TenderCompanyProfileService(db);
    service = new TenderAnalysisService(
      db,
      { enrich } as never,
      { enrich } as never,
      { fetch },
      {
        extract: async () => ({
          status: "EXTRACTED",
          blocks: [
            {
              kind: "text",
              ordinal: 0,
              location: "p1",
              text: "소비전력 30W 이하",
            },
          ],
          metadata: {},
        }),
      } as never,
      profile,
      new TenderPriceAnalyzer(),
    );
  });
  it("queues a current job without waiting for enrichment and completes with safe detail and list summaries", async () => {
    const queued = await service.reanalyze(tender.id, now);
    expect(queued.status).toBe("PENDING");
    expect(enrich).not.toHaveBeenCalled();
    expect(await service.processDue(now, 2)).toMatchObject({ processed: 1 });
    const result = await service.getAnalysis(tender.id);
    expect(result).toMatchObject({ status: "COMPLETED", reviewed: false });
    expect(result.priceAnalysis.official.status).toBe(
      "FORMULA_REVIEW_REQUIRED",
    );
    const summaries = await service.getSummaries([tender.id]);
    expect(Object.keys(summaries.get(tender.id)).sort()).toEqual([
      "analyzedAt",
      "specificationScore",
      "status",
      "suitability",
      "unknownCount",
    ]);
    expect(JSON.stringify(result)).not.toContain("textBlocks");
    expect(JSON.stringify(result)).not.toContain("processingToken");
  });
  it("claims once across two workers and fences an expired worker after another worker completes", async () => {
    expect(await service.reanalyze(tender.id, now)).toMatchObject({
      status: "PENDING",
    });
    let release!: (value: TenderEnrichment) => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    enrich.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const first = service.processDue(now, 1);
    await entered;
    expect(await service.processDue(now, 1)).toMatchObject({ processed: 0 });
    await db
      .getRepository(TenderAnalysis)
      .update({ tenderId: tender.id }, { leaseExpiresAt: new Date(0) });
    const second = await service.processDue(now, 1);
    expect(second.processed).toBe(1);
    const committed = await db
      .getRepository(TenderAnalysis)
      .findOneByOrFail({ tenderId: tender.id });
    release(emptyTenderEnrichment());
    await first;
    const after = await db
      .getRepository(TenderAnalysis)
      .findOneByOrFail({ tenderId: tender.id });
    expect(after).toEqual(committed);
  });
  it("keeps useful facts PARTIAL on each rerun when one document fails; stores normalized blocks only", async () => {
    enrichment.documents = ["good", "bad"].map((identity) => ({
      identity,
      displayName: "document",
      url: "https://www.g2b.go.kr/doc",
      formatHint: "DOCX",
      source: "G2B_API",
      sourceNoticeId: "fixture",
      revision: "000",
      evidence: { source: "G2B_API", operation: "fixture", field: "doc" },
    }));
    fetch.mockImplementation(async (ref) => {
      if (ref.identity === "bad") throw new Error("secret provider response");
      return {
        bytes: new Uint8Array([1]),
        detectedFormat: "DOCX",
        sha256: "a".repeat(64),
      };
    });
    for (let i = 0; i < 2; i++) {
      await service.reanalyze(tender.id, now);
      await service.processDue(now, 1);
      expect(await service.getAnalysis(tender.id)).toMatchObject({
        status: "PARTIAL",
      });
    }
    const documents = await db.getRepository(TenderDocument).find();
    expect(documents).toHaveLength(2);
    expect(
      documents.find((d) => d.sourceDocumentIdentity === "good").textBlocks[0],
    ).toMatchObject({ text: "소비전력 30W 이하" });
    expect(
      documents.find((d) => d.sourceDocumentIdentity === "bad").errorCode,
    ).toBe("DOCUMENT_FETCH_FAILED");
    expect(JSON.stringify(documents)).not.toMatch(
      /bytes|secret provider response/,
    );
  });
  it("invalidates the in-flight claim atomically on profile replacement and retains stale review history", async () => {
    await profile.replace(profileInput);
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const admin = await db
      .getRepository(Admin)
      .save({ username: "reviewer", password: "unused" });
    await service.saveReview(
      tender.id,
      { completed: true, note: "  checked  " },
      admin.id,
    );
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      reviewed: true,
    });
    await profile.replace({ ...profileInput, companyName: "changed" });
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      status: "PENDING",
      reviewed: false,
    });
    expect(await db.getRepository(TenderAnalysisReview).count()).toBe(1);
    expect(
      await db
        .getRepository(TenderAnalysisReview)
        .findOneByOrFail({ tenderId: tender.id }),
    ).toMatchObject({ reviewerAdminId: admin.id, note: "checked" });
  });
  it("does not commit if product or tender content changed during extraction", async () => {
    await service.reanalyze(tender.id, now);
    enrich.mockImplementationOnce(async () => {
      await db
        .getRepository(Tender)
        .update(tender.id, { title: "changed content" });
      return enrichment;
    });
    await service.processDue(now, 1);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      status: "PENDING",
      analyzedAt: null,
    });
  });
  it("keeps specification counts nonnegative when profile absence changes qualification evaluations to UNKNOWN", async () => {
    enrichment.licenses = [
      {
        code: "license",
        name: "license",
        required: true,
        group: null,
        evidence: { source: "G2B_API", operation: "fixture", field: "license" },
      },
    ];
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const result = await service.getAnalysis(tender.id);
    expect(result).toMatchObject({
      unsatisfiedCount: 0,
      comparableCount: 0,
      unknownCount: 3,
    });
  });
  it("profile update during a worker invalidates its token and rolls back completely if queue invalidation fails", async () => {
    await profile.replace(profileInput);
    await service.reanalyze(tender.id, now);
    enrich.mockImplementationOnce(async () => {
      await profile.replace({ ...profileInput, companyName: "new" });
      return enrichment;
    });
    await service.processDue(now, 1);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      status: "PENDING",
      analyzedAt: null,
    });
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(
        `CREATE FUNCTION "${schema}".reject_analysis_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture invalidation failure'; END $$`,
      );
      await runner.query(
        `CREATE TRIGGER reject_update BEFORE UPDATE ON "${schema}".tender_analyses FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_analysis_update()`,
      );
      await expect(
        profile.replace({ ...profileInput, companyName: "must rollback" }),
      ).rejects.toThrow("fixture invalidation failure");
      expect(await profile.get()).toMatchObject({
        companyName: "new",
        version: 2,
      });
    } finally {
      await runner.query(
        `DROP TRIGGER IF EXISTS reject_update ON "${schema}".tender_analyses`,
      );
      await runner.query(
        `DROP FUNCTION IF EXISTS "${schema}".reject_analysis_update()`,
      );
      await runner.release();
    }
  });

  it("skips another transaction's locked analysis row and finishes a different pending tender", async () => {
    await service.reanalyze(tender.id, now);
    const other = await db
      .getRepository(Tender)
      .save({ ...tender, id: undefined, sourceNoticeId: "other" });
    await service.reanalyze(other.id, now);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.manager.getRepository(TenderAnalysis).findOne({
        where: { tenderId: tender.id },
        lock: { mode: "pessimistic_write" },
      });
      expect(await service.processDue(now, 1)).toMatchObject({ processed: 1 });
      expect(await service.getAnalysis(other.id)).toMatchObject({
        status: "COMPLETED",
      });
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it("fences a product update made while enrichment is running", async () => {
    await service.reanalyze(tender.id, now);
    enrich.mockImplementationOnce(async () => {
      await db.getRepository(Product).save({
        name: "hidden",
        modelName: "hidden",
        category: "LED",
        dimensions: "10x20x30",
        power: [20],
        lifespan: 10000,
        colorTemp: [6500],
        ledChipManufacturer: "private",
        description: "private",
      });
      return enrichment;
    });
    await service.processDue(now, 1);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      status: "PENDING",
      analyzedAt: null,
    });
    expect(await db.getRepository(TenderDocument).count()).toBe(0);
  });
  it("corrective migration applies to empty identities and refuses to discard a legacy UUID", async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      await runner.query(
        'ALTER TABLE tender_analysis_reviews ALTER COLUMN "reviewerAdminId" TYPE uuid USING NULL::uuid',
      );
      await new FixTenderReviewAdminIdentity1788699100000().up(runner);
      const [column] = await runner.query(
        "SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name='tender_analysis_reviews' AND column_name='reviewerAdminId'",
        [schema],
      );
      expect(column.data_type).toBe("integer");
      await new FixTenderReviewAdminIdentity1788699100000().down(runner);
      await runner.query(
        'INSERT INTO tender_analysis_reviews ("tenderId", "analysisFingerprint", "reviewerAdminId") VALUES ($1,$2,$3)',
        [tender.id, "a".repeat(64), randomUUID()],
      );
      await expect(
        new FixTenderReviewAdminIdentity1788699100000().up(runner),
      ).rejects.toThrow("explicit migration");
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it("uses award history only when normalized enrichment supplies explicit safe pricing metadata", async () => {
    const evidence = {
      source: "G2B_API" as const,
      operation: "fixture",
      field: "verified",
    };
    enrichment.basisAmount = { value: "100", evidence };
    enrichment.lowerLimitRate = { value: "80", evidence };
    enrichment.lawKind = { value: "NATIONAL", evidence };
    Object.assign(enrichment, {
      pricingContext: {
        contractKind: "TOTAL",
        currency: "KRW",
        formulaKind: "STANDARD",
        awardMethod: "적격심사",
        productGroup: "LED",
      },
    });
    await db.getRepository(TenderAwardResult).save(
      Array.from({ length: 15 }, (_, i) => ({
        source: "G2B",
        sourceNoticeId: `history-${i}`,
        revision: "000",
        productClassification: "3911210201",
        productGroup: "LED",
        awardMethod: "적격심사",
        region: null,
        openedAt: new Date(now.getTime() - 86400000),
        basisAmount: "100",
        expectedPrice: "100",
        winningAmount: "90",
        adjustmentRate: "1",
        winningRate: "0.9",
        isFinalAward: true,
        isFailedBid: false,
      })),
    );
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      priceAnalysis: {
        basisAmount: "100",
        lowerLimitRate: "80",
        official: { status: "AVAILABLE" },
        statistics: {
          status: "AVAILABLE",
          sampleCount: 15,
          estimatedPrice: "90",
        },
      },
    });
    const reviewer = await db
      .getRepository(Admin)
      .save({ username: "price-reviewer", password: "unused" });
    await service.saveReview(
      tender.id,
      { completed: true, note: "price checked" },
      reviewer.id,
    );
    await db
      .getRepository(TenderAwardResult)
      .createQueryBuilder()
      .update()
      .set({ winningAmount: "95", winningRate: "0.95" })
      .execute();
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      reviewed: false,
      priceAnalysis: { statistics: { estimatedPrice: "95" } },
    });
    delete (enrichment as any).pricingContext;
    await db
      .getRepository(Tender)
      .update(tender.id, { source: TenderSource.KAPT });
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      priceAnalysis: {
        official: { status: "FORMULA_REVIEW_REQUIRED" },
        statistics: { status: "INCOMPARABLE_CONTRACT", estimatedPrice: null },
      },
    });
  });

  it("renews only its live fenced lease before bounded document processing", async () => {
    enrichment.documents = [
      {
        identity: "doc",
        displayName: "doc",
        url: "https://www.g2b.go.kr/doc",
        formatHint: "DOCX",
        source: "G2B_API",
        sourceNoticeId: "fixture",
        revision: "000",
        evidence: { source: "G2B_API", operation: "fixture", field: "doc" },
      },
    ];
    enrich.mockImplementationOnce(async () => {
      await db
        .getRepository(TenderAnalysis)
        .update(
          { tenderId: tender.id },
          { leaseExpiresAt: new Date(Date.now() + 1000) },
        );
      return enrichment;
    });
    let remainingLease = 0;
    fetch.mockImplementationOnce(async () => {
      const row = await db
        .getRepository(TenderAnalysis)
        .findOneByOrFail({ tenderId: tender.id });
      remainingLease = row.leaseExpiresAt.getTime() - Date.now();
      return {
        bytes: new Uint8Array([1]),
        detectedFormat: "DOCX",
        sha256: "a".repeat(64),
      };
    });
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    expect(remainingLease).toBeGreaterThan(240_000);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      status: "COMPLETED",
    });
  });

  it("one deterministic global catalog fingerprint detects additions, updates and deletions", async () => {
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    expect(await service.refreshStaleAnalyses()).toMatchObject({
      queuedCount: 0,
    });
    await db.getRepository(Product).save({
      name: "PRIVATE PRODUCT NAME",
      modelName: "hidden",
      category: "LED",
      dimensions: "10x20x30",
      power: [20],
      lifespan: 10000,
      colorTemp: [6500],
      ledChipManufacturer: "private",
      description: "private",
    });
    expect(await service.refreshStaleAnalyses()).toMatchObject({
      queuedCount: 1,
    });
    await service.processDue(now, 1);
    expect(JSON.stringify(await service.getAnalysis(tender.id))).not.toContain(
      "PRIVATE PRODUCT NAME",
    );
    expect(await service.refreshStaleAnalyses()).toMatchObject({
      queuedCount: 0,
    });
    await db
      .getRepository(Product)
      .createQueryBuilder()
      .update()
      .set({ updatedAt: new Date(now.getTime() + 60_000) })
      .execute();
    expect(await service.refreshStaleAnalyses()).toMatchObject({
      queuedCount: 1,
    });
    await service.processDue(now, 1);
    await db.getRepository(Product).createQueryBuilder().delete().execute();
    expect(await service.refreshStaleAnalyses()).toMatchObject({
      queuedCount: 1,
    });
  });
});

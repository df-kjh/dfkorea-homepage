import { AddTenderReviewSemanticDigest1788699200000 } from "../../migrations/1788699200000-AddTenderReviewSemanticDigest";
import { compactAnalysisEvidence } from "./tender-analysis-evidence";
import { analysisFingerprint } from "./tender-analysis-queue";
import { TenderRequirementParser } from "../domain/tender-requirement-parser";
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
  let extract: jest.Mock;
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
    extract = jest.fn(async () => ({
      status: "EXTRACTED",
      blocks: [
        { kind: "text", ordinal: 0, location: "p1", text: "소비전력 30W 이하" },
      ],
      metadata: {},
    }));
    service = new TenderAnalysisService(
      db,
      { enrich } as never,
      { enrich } as never,
      { fetch },
      { extract } as never,
      profile,
      new TenderPriceAnalyzer(),
    );
  });
  const documentReference = () => ({
    identity: "large-document",
    displayName: "fixture",
    url: "https://www.g2b.go.kr/doc",
    formatHint: "DOCX" as const,
    source: "G2B_API" as const,
    sourceNoticeId: "fixture",
    revision: "000",
    evidence: {
      source: "G2B_API" as const,
      operation: "fixture",
      field: "doc",
    },
  });

  it("persists and projects only bounded linked evidence from 140k unrelated text and tables, including legacy rows", async () => {
    const unrelated = "UNRELATED_TEXT ".repeat(10000);
    const tableUnrelated = "UNRELATED_TABLE ".repeat(10000);
    const blocks = [
      {
        kind: "text" as const,
        ordinal: 0,
        location: "unrelated-page",
        text: unrelated,
      },
      {
        kind: "table" as const,
        ordinal: 1,
        location: "unrelated-table",
        rows: [[tableUnrelated]],
      },
      {
        kind: "text" as const,
        ordinal: 2,
        location: "page:3",
        text: `${unrelated}
소비전력 30W 이하`,
      },
      {
        kind: "table" as const,
        ordinal: 3,
        location: "table:4",
        rows: [[tableUnrelated], ["색온도 6500K 이하"]],
      },
    ];
    enrichment.purchaseItems = [];
    enrichment.documents = [documentReference()];
    extract.mockResolvedValue({ status: "EXTRACTED", blocks, metadata: {} });
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const row = await db
      .getRepository(TenderAnalysis)
      .findOneByOrFail({ tenderId: tender.id });
    const assertCompact = (evidence: Record<string, unknown>[]) => {
      expect(Buffer.byteLength(JSON.stringify(evidence))).toBeLessThanOrEqual(
        48 * 1024,
      );
      expect(evidence.length).toBeLessThanOrEqual(80);
      expect(
        evidence.some(
          (value) =>
            value.location === "unrelated-page" ||
            value.location === "unrelated-table",
        ),
      ).toBe(false);
      expect(evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            documentIdentity: "large-document",
            location: "page:3",
            snippet: expect.stringContaining("소비전력 30W"),
          }),
        ]),
      );
      for (const value of evidence) {
        expect(Array.from(String(value.snippet)).length).toBeLessThanOrEqual(
          320,
        );
        expect(String(value.snippet)).not.toMatch(/[\u0000-\u0008]/);
      }
      expect(JSON.stringify(evidence)).not.toContain(unrelated);
      expect(JSON.stringify(evidence)).not.toContain(tableUnrelated);
    };
    assertCompact(row.evidence);
    const legacy = new TenderRequirementParser().parse(enrichment, [
      {
        identity: "large-document",
        revision: "000",
        status: "EXTRACTED",
        blocks,
        metadata: {},
      },
    ]);
    await db.getRepository(TenderAnalysis).update(row.id, {
      evidence: legacy.evidence.map((value) => ({ ...value })),
    });
    const response = await service.getAnalysis(tender.id);
    if (!("evidence" in response)) throw new Error("Expected analysis");
    assertCompact(response.evidence);
    expect(Buffer.byteLength(JSON.stringify(response))).toBeLessThan(60 * 1024);
  });

  it("enforces evidence byte, global, item and requirement citation limits for existing rows", async () => {
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const evidence: Record<string, unknown>[] = [];
    const requirements = Array.from({ length: 10 }, (_, itemIndex) => ({
      key: `item-${itemIndex}`,
      classificationCode: `code-${itemIndex}`,
      specifications: Array.from({ length: 5 }, (_, specIndex) => ({
        id: `spec-${itemIndex}-${specIndex}`,
        itemKey: `item-${itemIndex}`,
        kind: "POWER",
        comparator: "LTE",
        value: "30",
        unit: "W",
        required: true,
        evidenceIds: Array.from({ length: 8 }, (_, index) => {
          const id = `${itemIndex}-${specIndex}-${index}`;
          evidence.push({
            id,
            kind: "SOURCE",
            source: "DOCUMENT",
            documentIdentity: `item-${itemIndex}`,
            location: `paragraph-${specIndex}`,
            snippet: `소비전력 30W 이하 ${"긴설명".repeat(150)}`,
            state: null,
          });
          return id;
        }),
      })),
    }));
    await db
      .getRepository(TenderAnalysis)
      .update({ tenderId: tender.id }, { requirements, evidence });
    const response = await service.getAnalysis(tender.id);
    if (!("evidence" in response)) throw new Error("Expected analysis");
    expect(response.evidence.length).toBeLessThanOrEqual(80);
    expect(
      Buffer.byteLength(JSON.stringify(response.evidence)),
    ).toBeLessThanOrEqual(48 * 1024);
    for (const item of requirements) {
      expect(
        response.evidence.filter((value) => value.documentIdentity === item.key)
          .length,
      ).toBeLessThanOrEqual(12);
      for (const spec of item.specifications)
        expect(
          response.evidence.filter((value) =>
            spec.evidenceIds.includes(String(value.id)),
          ).length,
        ).toBeLessThanOrEqual(4);
    }
    expect(response.evidence.length).toBeGreaterThan(0);
  });

  it("invalidates review when structured specification changes 30W to 40W with the same score and inputs", async () => {
    await profile.replace(profileInput);
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
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const reviewer = await db
      .getRepository(Admin)
      .save({ username: "spec-reviewer", password: "unused" });
    await service.saveReview(
      tender.id,
      { completed: true, note: "30W checked" },
      reviewer.id,
    );
    const before = await service.getAnalysis(tender.id);
    expect(before).toMatchObject({ reviewed: true, specificationScore: 100 });
    enrichment.purchaseItems[0].specification = "소비전력 40W 이하";
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const after = await service.getAnalysis(tender.id);
    expect(after).toMatchObject({ reviewed: false, specificationScore: 100 });
    expect(after.analysisFingerprint).not.toBe(before.analysisFingerprint);
    expect(await db.getRepository(TenderAnalysisReview).count()).toBe(1);
  });

  it("persists a full semantic digest while bounding provider formula strings and legacy detail", async () => {
    const bulk = "제공자본문".repeat(28000);
    enrichment.formulaVariables = [
      {
        key: "plannedPriceMethod",
        value: `예정가격 ${bulk} 끝조건A`,
        evidence: { source: "G2B_API", operation: "fixture", field: "planned" },
      },
    ];
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const stored = await db
      .getRepository(TenderAnalysis)
      .findOneByOrFail({ tenderId: tender.id });
    expect((stored as any).reviewSemanticDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored.priceAnalysis).length).toBeLessThan(3000);
    expect(JSON.stringify(stored.priceAnalysis)).not.toContain(bulk);
    expect(
      stored.evidence.some(
        (value) => value.diagnosticCategory === "TRUNCATION",
      ),
    ).toBe(true);
    const reviewer = await db
      .getRepository(Admin)
      .save({ username: "bounded-reviewer", password: "unused" });
    await service.saveReview(
      tender.id,
      { completed: true, note: "bounded" },
      reviewer.id,
    );
    const before = await service.getAnalysis(tender.id);
    enrichment.formulaVariables[0].value = `예정가격 ${bulk} 끝조건B`;
    await service.reanalyze(tender.id, now);
    await service.processDue(now, 1);
    const after = await service.getAnalysis(tender.id);
    expect(after.reviewed).toBe(false);
    expect(after.analysisFingerprint).not.toBe(before.analysisFingerprint);
    expect((after.priceAnalysis.formula as any).plannedPriceMethod).toEqual(
      (before.priceAnalysis.formula as any).plannedPriceMethod,
    );
    await db.getRepository(TenderAnalysis).update(stored.id, {
      priceAnalysis: {
        formula: { plannedPriceMethod: bulk, reservePriceMethod: bulk },
        providerPayload: bulk,
      },
      participationAnalysis: {
        requirements: [{ id: "legacy", label: bulk, values: [bulk] }],
        evaluations: [],
      },
    });
    const legacy = await service.getAnalysis(tender.id);
    expect(Buffer.byteLength(JSON.stringify(legacy))).toBeLessThan(30000);
    expect(JSON.stringify(legacy)).not.toContain(bulk);
  });

  it("retains review history but invalidates a changed undisplayed mandatory diagnostic", async () => {
    const parsed = new TenderRequirementParser().parse(enrichment, []);
    const diagnostic = (index: number) => ({
      id: `unknown-${index}`,
      kind: "UNSUPPORTED" as const,
      source: "DOCUMENT" as const,
      documentIdentity: "doc",
      location: `p${String(index).padStart(3, "0")}`,
      state: "UNKNOWN" as const,
      snippet: `조건${String(index).padStart(3, "0")} 필수 제출하여야 한다`,
    });
    parsed.evidence.push(
      ...Array.from({ length: 90 }, (_, index) => diagnostic(index)),
    );
    const parser = jest
      .spyOn(TenderRequirementParser.prototype, "parse")
      .mockReturnValue(parsed);
    try {
      await service.reanalyze(tender.id, now);
      await service.processDue(now, 1);
      const reviewer = await db
        .getRepository(Admin)
        .save({ username: "undisplayed-reviewer", password: "unused" });
      await service.saveReview(
        tender.id,
        { completed: true, note: "all conditions checked" },
        reviewer.id,
      );
      const before = await service.getAnalysis(tender.id);
      parsed.evidence.at(-1)!.snippet =
        "조건089 대체 인증 필수 제출하여야 한다";
      await service.reanalyze(tender.id, now);
      await service.processDue(now, 1);
      const after = await service.getAnalysis(tender.id);
      expect((after as any).evidence).toEqual((before as any).evidence);
      expect(after.reviewed).toBe(false);
      expect(after.analysisFingerprint).not.toBe(before.analysisFingerprint);
      expect(await db.getRepository(TenderAnalysisReview).count()).toBe(1);
    } finally {
      parser.mockRestore();
    }
  });

  it("persists and returns identical capped conflicts after reversing tied parser input", async () => {
    const parsed = new TenderRequirementParser().parse(enrichment, []);
    const sources = Array.from({ length: 12 }, (_, index) => ({
      id: `conflict-source-${index}`,
      kind: "SOURCE" as const,
      source: "DOCUMENT" as const,
      state: null,
      documentIdentity: "doc",
      location: `p${index}`,
      snippet: "소비전력 40W 이하",
    }));
    parsed.evidence.push(
      ...sources,
      ...sources.map((source, index) => ({
        id: `tied-conflict-${index}`,
        kind: "CONFLICT" as const,
        source: "STRUCTURED" as const,
        state: "UNKNOWN" as const,
        conflictField: "POWER",
        snippet: "구조화 값과 문서의 소비전력 조건이 충돌합니다.",
        relatedEvidenceIds: [source.id, "missing-structured-source"],
      })),
    );
    const parser = jest
      .spyOn(TenderRequirementParser.prototype, "parse")
      .mockReturnValue(parsed);
    try {
      await service.reanalyze(tender.id, now);
      await service.processDue(now, 1);
      const before = await db
        .getRepository(TenderAnalysis)
        .findOneByOrFail({ tenderId: tender.id });
      const responseBefore = await service.getAnalysis(tender.id);
      expect(
        before.evidence.filter((value) => value.kind === "CONFLICT"),
      ).toHaveLength(8);
      parsed.evidence.reverse();
      parsed.evidence.forEach((value) => value.relatedEvidenceIds?.reverse());
      await service.reanalyze(tender.id, now);
      await service.processDue(now, 1);
      const after = await db
        .getRepository(TenderAnalysis)
        .findOneByOrFail({ tenderId: tender.id });
      const responseAfter = await service.getAnalysis(tender.id);
      expect(after.evidence).toEqual(before.evidence);
      expect((responseAfter as any).evidence).toEqual(
        (responseBefore as any).evidence,
      );
      expect((responseAfter as any).evidence).toEqual(after.evidence);
      expect(after.reviewSemanticDigest).toBe(before.reviewSemanticDigest);
      expect(responseAfter.analysisFingerprint).toBe(
        responseBefore.analysisFingerprint,
      );
    } finally {
      parser.mockRestore();
    }
  });

  it("cannot commit after a catalog lock wait outlasts its lease; a fresh worker can recover", async () => {
    enrichment.documents = [documentReference()];
    const blocker = db.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    const [{ pid }] = await blocker.query("SELECT pg_backend_pid() AS pid");
    await blocker.query(
      `LOCK TABLE "${schema}".products IN ROW EXCLUSIVE MODE`,
    );
    let entered!: () => void;
    const extractionFinished = new Promise<void>((resolve) => {
      entered = resolve;
    });
    extract.mockImplementationOnce(async () => {
      await db
        .getRepository(TenderAnalysis)
        .update(
          { tenderId: tender.id },
          { leaseExpiresAt: new Date(Date.now() + 400) },
        );
      entered();
      return {
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
      };
    });
    await service.reanalyze(tender.id, now);
    const work = service.processDue(now, 1);
    try {
      await extractionFinished;
      let blocked = false;
      for (let i = 0; i < 30 && !blocked; i++) {
        const [result] = await db.query(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked",
          [pid],
        );
        blocked = result.blocked;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await db.query("SELECT pg_sleep(0.65)");
    } finally {
      await blocker.rollbackTransaction();
      await blocker.release();
      await work;
    }
    expect(
      await db
        .getRepository(TenderAnalysis)
        .findOneByOrFail({ tenderId: tender.id }),
    ).toMatchObject({
      status: "PROCESSING",
      analyzedAt: null,
      requirements: null,
      evidence: null,
      unknownRequirementCount: 0,
    });
    expect(await db.getRepository(TenderDocument).count()).toBe(0);
    await service.processDue(now, 1);
    expect(await service.getAnalysis(tender.id)).toMatchObject({
      status: "COMPLETED",
    });
  });

  it("rolls back document writes if the lease expires after the initial fenced read", async () => {
    enrichment.documents = [documentReference()];
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.query(
      `CREATE FUNCTION "${schema}".slow_document_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.6); RETURN NEW; END $$`,
    );
    await runner.query(
      `CREATE TRIGGER slow_insert BEFORE INSERT ON "${schema}".tender_documents FOR EACH ROW EXECUTE FUNCTION "${schema}".slow_document_insert()`,
    );
    extract.mockImplementationOnce(async () => {
      await db
        .getRepository(TenderAnalysis)
        .update(
          { tenderId: tender.id },
          { leaseExpiresAt: new Date(Date.now() + 350) },
        );
      return {
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
      };
    });
    try {
      await service.reanalyze(tender.id, now);
      await service.processDue(now, 1);
      expect(
        await db
          .getRepository(TenderAnalysis)
          .findOneByOrFail({ tenderId: tender.id }),
      ).toMatchObject({
        status: "PROCESSING",
        analyzedAt: null,
        evidence: null,
        unknownRequirementCount: 0,
      });
      expect(await db.getRepository(TenderDocument).count()).toBe(0);
    } finally {
      await runner.query(
        `DROP TRIGGER slow_insert ON "${schema}".tender_documents`,
      );
      await runner.query(`DROP FUNCTION "${schema}".slow_document_insert()`);
      await runner.release();
    }
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
  it("adds the semantic digest without inventing legacy facts and reverses only that column", async () => {
    await service.reanalyze(tender.id, now);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      const migration = new AddTenderReviewSemanticDigest1788699200000();
      await migration.down(runner);
      await migration.up(runner);
      const [row] = await runner.query(
        'SELECT "reviewSemanticDigest", status FROM tender_analyses WHERE "tenderId"=$1',
        [tender.id],
      );
      expect(row).toEqual({ reviewSemanticDigest: null, status: "PENDING" });
      await expect(
        runner.query('UPDATE tender_analyses SET "reviewSemanticDigest"=$1', [
          "a".repeat(65),
        ]),
      ).rejects.toThrow(/value too long/);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
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

describe("review fingerprint requirement semantics", () => {
  const fixture = () =>
    ({
      tenderFingerprint: "tender",
      documentFingerprint: "document",
      companyProfileFingerprint: "profile",
      productCatalogFingerprint: "products",
      analyzerVersion: "rules-1",
      suitability: "RECOMMENDED",
      specificationScore: "100.00",
      requirements: [
        {
          key: "item-a",
          classificationCode: "A",
          specifications: [
            {
              id: "spec-1",
              itemKey: "item-a",
              kind: "POWER",
              value: "30",
              unit: "W",
              comparator: "LTE",
              required: true,
              evidenceIds: ["source-1"],
            },
            {
              id: "spec-2",
              itemKey: "item-a",
              kind: "CRI",
              value: "80",
              unit: "CRI",
              comparator: "GTE",
              required: false,
              evidenceIds: ["source-2"],
            },
          ],
          evidenceIds: ["source-1", "source-2"],
        },
      ],
      evidence: [
        {
          id: "source-1",
          kind: "SOURCE",
          source: "DOCUMENT",
          documentIdentity: "doc",
          location: "p1",
          snippet: "소비전력 30W 이하",
          state: null,
        },
        {
          id: "source-2",
          kind: "SOURCE",
          source: "DOCUMENT",
          documentIdentity: "doc",
          location: "p2",
          snippet: "연색성 80 이상",
          state: null,
        },
      ],
    }) as unknown as TenderAnalysis;
  it("ignores irrelevant ordering and snippet formatting/derived identifiers", () => {
    const before = fixture();
    const after = structuredClone(before);
    after.requirements.reverse();
    (after.requirements[0].specifications as any[]).reverse();
    const replaceIds = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(replaceIds)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, child]) => [
                key,
                replaceIds(child),
              ]),
            )
          : typeof value === "string"
            ? value
                .replace(/source-/g, "new-source-")
                .replace(/spec-/g, "new-spec-")
            : value;
    const cosmetic = replaceIds(after) as TenderAnalysis;
    cosmetic.evidence.reverse();
    cosmetic.evidence[0].snippet = "  연색성   80 이상  ";
    expect(analysisFingerprint(cosmetic)).toBe(analysisFingerprint(before));
  });
  it("keeps capped evidence selection stable under item order and derived-ID changes", () => {
    const before = fixture();
    before.requirements = Array.from({ length: 100 }, (_, index) => ({
      key: `item-${index}`,
      classificationCode: `item-${index}`,
      specifications: [
        {
          id: `spec-${index}`,
          itemKey: `item-${index}`,
          kind: "POWER",
          value: "30",
          unit: "W",
          comparator: "LTE",
          required: true,
          evidenceIds: [`source-${index}`],
        },
      ],
    }));
    before.evidence = Array.from({ length: 100 }, (_, index) => ({
      id: `source-${index}`,
      kind: "SOURCE",
      source: "DOCUMENT",
      documentIdentity: `doc-${index}`,
      location: "p1",
      snippet: `소비전력 30W 이하 ${"긴설명".repeat(150)}`,
      state: null,
    }));
    const after = structuredClone(before);
    after.requirements.reverse();
    after.evidence.reverse();
    expect(analysisFingerprint(after)).toBe(analysisFingerprint(before));

    const manyRefs = fixture();
    manyRefs.requirements = [
      {
        key: "item-a",
        specifications: [
          {
            id: "spec-a",
            itemKey: "item-a",
            kind: "POWER",
            value: "30",
            unit: "W",
            comparator: "LTE",
            required: true,
            evidenceIds: Array.from({ length: 8 }, (_, index) => `id-${index}`),
          },
        ],
      },
    ];
    manyRefs.evidence = Array.from({ length: 8 }, (_, index) => ({
      id: `id-${index}`,
      kind: "SOURCE",
      source: "DOCUMENT",
      documentIdentity: "doc",
      location: `p${index}`,
      snippet: "소비전력 30W 이하",
      state: null,
    }));
    const relabeled = structuredClone(manyRefs);
    (relabeled.requirements[0].specifications as any[])[0].evidenceIds =
      Array.from({ length: 8 }, (_, index) => `new-id-${7 - index}`);
    relabeled.evidence.forEach((value, index) => {
      value.id = `new-id-${7 - index}`;
    });
    expect(analysisFingerprint(relabeled)).toBe(analysisFingerprint(manyRefs));
  });

  it("hashes mandatory diagnostics beyond both per-category and global display caps", () => {
    const before = fixture();
    before.evidence = Array.from({ length: 90 }, (_, index) => ({
      id: `diagnostic-${index}`,
      kind: "UNSUPPORTED",
      source: "DOCUMENT",
      documentIdentity: "doc",
      location: `p${String(index).padStart(3, "0")}`,
      state: "UNKNOWN",
      snippet: `조건${String(index).padStart(3, "0")} 필수`,
    }));
    for (const index of [12, 89]) {
      const after = structuredClone(before);
      after.evidence[index].snippet =
        `조건${String(index).padStart(3, "0")} 새로운 필수 인증`;
      expect(analysisFingerprint(after)).not.toBe(analysisFingerprint(before));
    }
  });

  it("reserves diagnostic categories before ordinary source citations exhaust the cap", () => {
    const input = fixture();
    input.requirements = Array.from({ length: 100 }, (_, index) => ({
      key: `item-${index}`,
      specifications: [
        { id: `r-${index}`, kind: "POWER", evidenceIds: [`s-${index}`] },
      ],
    }));
    input.evidence = Array.from({ length: 100 }, (_, index) => ({
      id: `s-${index}`,
      kind: "SOURCE",
      source: "DOCUMENT",
      documentIdentity: `doc-${index}`,
      location: "p1",
      snippet: "소비전력 30W 이하",
    }));
    input.evidence.push(
      {
        id: "unsupported",
        kind: "UNSUPPORTED",
        source: "DOCUMENT",
        state: "UNKNOWN",
        snippet: "추가 인증 필수",
      },
      {
        id: "conflict",
        kind: "CONFLICT",
        source: "STRUCTURED",
        state: "UNKNOWN",
        snippet: "조건 충돌",
        conflictField: "POWER",
      },
    );
    input.errorCode = "ANALYSIS_SOURCE_FAILURE";
    const evidence = compactAnalysisEvidence(input);
    expect(evidence.some((value) => value.kind === "UNSUPPORTED")).toBe(true);
    expect(evidence.some((value) => value.kind === "CONFLICT")).toBe(true);
    expect(
      evidence.some((value) => value.diagnosticCategory === "SOURCE_FAILURE"),
    ).toBe(true);
    expect(evidence.length).toBeLessThanOrEqual(80);
    expect(Buffer.byteLength(JSON.stringify(evidence))).toBeLessThanOrEqual(
      48 * 1024,
    );
  });

  it("canonicalizes multi-item key sets before allocating citation buckets", () => {
    const before = fixture();
    before.requirements = [];
    before.certificationAnalysis = {
      requirements: Array.from({ length: 16 }, (_, index) => ({
        id: `cert-${index}`,
        code: `C${index}`,
        itemKeys: index < 12 ? ["a"] : ["a", "b"],
        evidenceIds: [`s-${index}`],
        required: true,
      })),
    };
    before.evidence = Array.from({ length: 16 }, (_, index) => ({
      id: `s-${index}`,
      kind: "SOURCE",
      source: "DOCUMENT",
      documentIdentity: "doc",
      location: `p${index}`,
      snippet: `인증 C${index} 필수`,
    }));
    const after = structuredClone(before);
    (after.certificationAnalysis.requirements as any[]).forEach(
      (value) =>
        (value.itemKeys = [...value.itemKeys, ...value.itemKeys].reverse()),
    );
    expect(compactAnalysisEvidence(after)).toEqual(
      compactAnalysisEvidence(before),
    );
    expect(analysisFingerprint(after)).toBe(analysisFingerprint(before));
  });

  it("preserves dimension and hierarchical region coordinate order", () => {
    const before = fixture();
    before.requirements = [
      {
        key: "item-a",
        specifications: [
          {
            id: "dimensions",
            itemKey: "item-a",
            kind: "DIMENSIONS",
            values: ["10", "20", "30"],
            unit: "MM",
            comparator: "LTE",
            required: true,
            evidenceIds: [],
          },
        ],
      },
    ];
    const dimensions = structuredClone(before);
    (dimensions.requirements[0].specifications as any[])[0].values.reverse();
    expect(analysisFingerprint(dimensions)).not.toBe(
      analysisFingerprint(before),
    );
    before.participationAnalysis = {
      requirements: [
        {
          id: "region",
          kind: "REGION",
          regionPaths: [
            { codes: ["41", "41590"], values: ["경기도", "화성시"] },
          ],
          required: true,
          evidenceIds: [],
        },
      ],
      evaluations: [],
    };
    const region = structuredClone(before);
    (
      region.participationAnalysis.requirements as any[]
    )[0].regionPaths[0].values.reverse();
    expect(analysisFingerprint(region)).not.toBe(analysisFingerprint(before));
  });

  it.each(["value", "required", "comparator", "itemKey"])(
    "invalidates a changed %s even when every score is the same",
    (field) => {
      const before = fixture();
      const after = structuredClone(before);
      const specification = (after.requirements[0].specifications as any[])[0];
      specification[field] = field === "required" ? false : `changed-${field}`;
      expect(analysisFingerprint(after)).not.toBe(analysisFingerprint(before));
    },
  );
});

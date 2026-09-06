# Tender Suitability Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add evidence-backed tender eligibility, specification coverage, certification, participation-condition, and bid-price analysis to the existing admin tender workflow for G2B goods and best-effort K-apt notices.

**Architecture:** Extend the existing NestJS `tenders` module with persistent analysis jobs, isolated document extractors, deterministic requirement rules, a singleton company bid profile, and normalized award-result statistics. Keep external calls behind provider-neutral adapters and show only compact evidence in the Nuxt admin UI. PostgreSQL leases and advisory locks provide restartability without Redis; source documents are parsed ephemerally and never stored as binary.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL, node-cron, Jest, Nuxt 4, Vue 3, TypeScript, Vitest, Vue Test Utils, `hwp-convert@1.13.x`, `pdfjs-dist`, `mammoth`, `exceljs`

**Spec:** `docs/superpowers/specs/2026-09-06-tender-suitability-analysis-design.md`

## Global Constraints

- G2B goods are the primary supported source; K-apt is best effort and must expose unavailable values as `UNKNOWN`/`확인 필요`.
- Do not add AI, OCR, R2, Redis, or a new required secret.
- Reuse `PUBLIC_DATA_SERVICE_KEY`; the separate G2B award-service approval is operational setup, not a new environment value.
- Never persist source-document binary, provider response payloads for award history, bidder names, bidder business numbers, or complete rankings.
- Keep money precision-safe as PostgreSQL `numeric`/`bigint` and serialized decimal strings.
- A specification score is never shown without counts for satisfied, unsatisfied, unknown, and total extracted requirements.
- A single product snapshot must satisfy a single procurement item's combined requirements; never combine unrelated products into a fictional complete product.
- Existing tender collection and mail delivery behavior must remain unchanged if enrichment, document extraction, or award collection fails.
- Update `database-schema.md`, `docs/menus/tenders.md`, `.env.example`, and `DEPLOYMENT.md` in the implementation.
- Every production behavior follows a witnessed RED → GREEN cycle before refactoring or committing.

---

### Task 1: Persistent analysis schema and entity contracts

**Files:**
- Create: `dfkorea-backend/src/migrations/1788699000000-CreateTenderAnalysisTables.ts`
- Create: `dfkorea-backend/src/migrations/tender-analysis.migrations.spec.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-company-profile.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-document.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-analysis.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-analysis-review.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-award-result.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-award-sync-run.entity.ts`
- Modify: `dfkorea-backend/src/tenders/entities/tender.entities.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`
- Modify: `database-schema.md`

**Interfaces:**
- Produces: TypeORM entities `TenderCompanyProfile`, `TenderDocument`, `TenderAnalysis`, `TenderAnalysisReview`, `TenderAwardResult`, and `TenderAwardSyncRun`.
- Produces: database uniqueness for one company profile, one current analysis per tender, one source document per tender identity, and one normalized award-result identity.

- [x] **Step 1: Write migration and metadata tests that fail because the entities and migration do not exist**

```ts
it('keeps one current suitability analysis per tender', () => {
  const unique = getMetadataArgsStorage().uniques.find(
    item => item.target === TenderAnalysis && item.name === 'UQ_tender_analysis_tender',
  )
  expect(unique?.columns).toEqual(['tenderId'])
})

it('does not create a binary document column', async () => {
  await migration.up(queryRunner)
  const sql = statements.join('\n')
  expect(sql).toContain('CREATE TABLE "tender_documents"')
  expect(sql).not.toMatch(/bytea|binary|blob/i)
})
```

- [x] **Step 2: Run the focused tests and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/entities/tender.entities.spec.ts migrations/tender-analysis.migrations.spec.ts`

Expected: FAIL on missing imports/files and absent metadata.

- [x] **Step 3: Implement the six entities and additive migration**

Use these exact enums and public field shapes as the shared persistence contract:

```ts
export enum TenderAnalysisStatus { PENDING='PENDING', PROCESSING='PROCESSING', COMPLETED='COMPLETED', PARTIAL='PARTIAL', FAILED='FAILED' }
export enum TenderSuitability { RECOMMENDED='RECOMMENDED', REVIEW='REVIEW', DIFFICULT='DIFFICULT' }
export enum TenderRequirementState { SATISFIED='SATISFIED', UNSATISFIED='UNSATISFIED', UNKNOWN='UNKNOWN' }
export enum TenderDocumentStatus { PENDING='PENDING', EXTRACTED='EXTRACTED', PARTIAL='PARTIAL', FAILED='FAILED', UNSUPPORTED='UNSUPPORTED' }
export enum TenderAwardSyncStatus { RUNNING='RUNNING', SUCCEEDED='SUCCEEDED', PARTIAL='PARTIAL', FAILED='FAILED' }
```

Store JSONB only for normalized profile collections, extracted text/table blocks, requirements, evidence, and compact price analysis. Add indexes on analysis status/lease, document tender/status, award openedAt/productClassification/awardMethod/region, and award sync status/lease. `down()` drops only the six new tables in reverse FK order.

- [x] **Step 4: Register entities and update schema documentation**

Add every entity to `TypeOrmModule.forFeature`. Existing glob discovery already covers `tenders/entities/*.entity`; verify it instead of changing the glob. Document columns, FKs, unique constraints, indexes, and the no-binary/no-bidder-data rule in `database-schema.md`.

- [x] **Step 5: Run focused tests and verify GREEN**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/entities/tender.entities.spec.ts migrations/tender-analysis.migrations.spec.ts`

Expected: PASS with migration SQL covering every entity constraint.

- [x] **Step 6: Commit**

```bash
git add dfkorea-backend/src/migrations/1788699000000-CreateTenderAnalysisTables.ts dfkorea-backend/src/migrations/tender-analysis.migrations.spec.ts dfkorea-backend/src/tenders/entities dfkorea-backend/src/tenders/tenders.module.ts database-schema.md
git commit -m "feat: add tender analysis data model"
```

---

### Task 2: Company bid-profile API

**Files:**
- Create: `dfkorea-backend/src/tenders/dto/tender-company-profile.dto.ts`
- Create: `dfkorea-backend/src/tenders/dto/tender-company-profile.dto.spec.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-company-profile.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-company-profile.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`
- Modify: `dfkorea-backend/test/tenders.contract-spec.ts`
- Modify: `dfkorea-backend/test/tender-app-integration.spec.ts`

**Interfaces:**
- Produces: `TenderCompanyProfileService.get()` and `TenderCompanyProfileService.replace(dto)`.
- Produces: `GET /tenders/company-profile` and `PUT /tenders/company-profile` under existing `JwtAuthGuard`.
- Profile collections use `{ code: string; name: string; expiresAt: string | null }`; performance records use `{ itemName: string; from: string; to: string; amount: string }`.

- [x] **Step 1: Write failing DTO and service tests**

Name the breaks: expired documents counted as valid, duplicate codes accepted, malformed business numbers accepted, and profile versions not incremented.

```ts
it('normalizes codes and increments the singleton profile version', async () => {
  const saved = await service.replace({
    companyName: '디에프코리아', businessNumber: '123-45-67890',
    headquarters: { sido: '경기도', sigungu: '화성시' },
    g2bRegistered: true,
    supplyProducts: [{ code: '39112102', name: 'LED보안등기구', expiresAt: null }],
    licenses: [], companyTypes: [], directProduction: [], certifications: [], performanceRecords: [],
  })
  expect(saved.version).toBe(1)
  expect(saved.businessNumber).toBe('1234567890')
})
```

- [x] **Step 2: Run and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/dto/tender-company-profile.dto.spec.ts tenders/services/tender-company-profile.service.spec.ts tenders/tenders.controller.spec.ts`

Expected: FAIL because profile DTO/service/routes are missing.

- [x] **Step 3: Implement validation and atomic singleton replacement**

Use `@ValidateNested`, `@IsArray`, `@ArrayMaxSize(100)`, ISO date validation, decimal-string validation, trimmed nonempty names, normalized digits-only business number, and duplicate code/name rejection within each collection. Run replace in one transaction with row lock; version is previous+1. Preserve no historical profile payload beyond the current row.

- [x] **Step 4: Implement static routes before `GET :id`**

Controller methods call only the service. Verify unauthenticated access remains rejected through the existing controller integration contract.

- [x] **Step 5: Run focused tests and verify GREEN**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/dto/tender-company-profile.dto.spec.ts tenders/services/tender-company-profile.service.spec.ts tenders/tenders.controller.spec.ts`

- [x] **Step 6: Commit**

```bash
git add dfkorea-backend/src/tenders/dto/tender-company-profile.dto.ts dfkorea-backend/src/tenders/dto/tender-company-profile.dto.spec.ts dfkorea-backend/src/tenders/services/tender-company-profile.service.ts dfkorea-backend/src/tenders/services/tender-company-profile.service.spec.ts dfkorea-backend/src/tenders/tenders.controller.ts dfkorea-backend/src/tenders/tenders.controller.spec.ts dfkorea-backend/src/tenders/tenders.module.ts
git commit -m "feat: manage company tender qualifications"
```

---

### Task 3: Structured G2B enrichment and safe K-apt document discovery

**Files:**
- Create: `dfkorea-backend/src/tenders/domain/tender-enrichment.ts`
- Create: `dfkorea-backend/src/tenders/adapters/g2b-enrichment.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/g2b-enrichment.adapter.spec.ts`
- Create: `dfkorea-backend/src/tenders/adapters/kapt-enrichment.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/kapt-enrichment.adapter.spec.ts`
- Create: `dfkorea-backend/src/tenders/documents/tender-document-fetcher.ts`
- Create: `dfkorea-backend/src/tenders/documents/tender-document-fetcher.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`
- Modify: `led-lighting-website/src/server/utils/g2b-relay.ts`
- Modify: `led-lighting-website/src/server/utils/g2b-relay.spec.ts`
- Modify: `led-lighting-website/src/server/api/internal/g2b-relay.post.spec.ts`

**Interfaces:**
- Produces: `TenderEnrichmentAdapter.enrich(tender, signal): Promise<TenderEnrichment>`.
- `TenderEnrichment` contains `basisAmount`, `lowerLimitRate`, `lawKind`, `formulaVariables`, `regions`, `licenses`, `purchaseItems`, and `documents`; every fact carries `EvidenceRef`.
- Produces: `TenderDocumentFetcher.fetch(document, signal): Promise<{ bytes: Uint8Array; detectedFormat: TenderDocumentFormat; sha256: string }>`.

- [x] **Step 1: Write failing official-fixture adapter tests**

Add complete recorded response shapes for G2B goods basis amount, license limits, participant regions, target products, and up to ten specification-document URLs. For K-apt, assert only same-notice links from the canonical `https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=...` page are accepted.

```ts
expect(result).toEqual(expect.objectContaining({
  basisAmount: { value: '100000000', evidence: expect.any(Object) },
  regions: [{ code: '41', name: '경기도', required: true, evidence: expect.any(Object) }],
  documents: [expect.objectContaining({ formatHint: 'HWP', source: 'G2B_API' })],
}))
```

- [x] **Step 2: Write failing fetch-security tests**

Exercise the real redirect and stream boundary with a local HTTP test server. Assert rejection for HTTP, off-allowlist redirect, 20 MiB+1 byte, MIME/magic mismatch, timeout, excessive redirect count, and a URL not produced by the matching adapter.

- [x] **Step 3: Run and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/adapters/g2b-enrichment.adapter.spec.ts tenders/adapters/kapt-enrichment.adapter.spec.ts tenders/documents/tender-document-fetcher.spec.ts`

Expected: FAIL on missing adapters/fetcher.

- [x] **Step 4: Implement G2B and K-apt enrichment adapters**

Reuse `PublicApiClient` pacing and safe error types. G2B operations are restricted to goods detail/basis/license/region/purchase-item data for one known notice. K-apt parses only direct attachment anchors from the canonical matching notice page, never login/CAPTCHA or arbitrary navigation. Each operation returns independent partial errors rather than dropping successful facts.

- [x] **Step 5: Implement the document fetch boundary**

Permit HTTPS official G2B/K-apt hosts, disable automatic redirects, validate each manual redirect, stream with the 20 MiB limit, enforce 15 seconds, inspect magic bytes, and return bytes only to the caller. Sanitize errors to stable codes such as `DOCUMENT_OFF_ALLOWLIST`, `DOCUMENT_TOO_LARGE`, `DOCUMENT_FORMAT_MISMATCH`, and `DOCUMENT_TIMEOUT`.

- [x] **Step 6: Extend the existing relay allowlist without adding configuration**

Permit only the new G2B goods enrichment operations and the fixed official base paths required by this task. Keep HMAC, time window, no-service-key request body, redirect rejection, and response-body redaction intact.

- [x] **Step 7: Run backend and frontend relay tests and verify GREEN**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/adapters/g2b-enrichment.adapter.spec.ts tenders/adapters/kapt-enrichment.adapter.spec.ts tenders/documents/tender-document-fetcher.spec.ts`

Run: `cd led-lighting-website && npm test -- src/server/utils/g2b-relay.spec.ts src/server/api/internal/g2b-relay.post.spec.ts`

- [x] **Step 8: Commit**

```bash
git add dfkorea-backend/src/tenders/domain/tender-enrichment.ts dfkorea-backend/src/tenders/adapters dfkorea-backend/src/tenders/documents dfkorea-backend/src/tenders/tenders.module.ts led-lighting-website/src/server/utils/g2b-relay.ts led-lighting-website/src/server/utils/g2b-relay.spec.ts led-lighting-website/src/server/api/internal/g2b-relay.post.spec.ts
git commit -m "feat: enrich tender notices and documents"
```

---

### Task 4: HWP/HWPX, PDF, DOCX, and XLSX text extraction

**Files:**
- Create: `dfkorea-backend/src/tenders/documents/tender-document-extractor.ts`
- Create: `dfkorea-backend/src/tenders/documents/tender-document-extractor.spec.ts`
- Create: `dfkorea-backend/src/tenders/documents/extractors/hwp-document.extractor.ts`
- Create: `dfkorea-backend/src/tenders/documents/extractors/pdf-document.extractor.ts`
- Create: `dfkorea-backend/src/tenders/documents/extractors/docx-document.extractor.ts`
- Create: `dfkorea-backend/src/tenders/documents/extractors/xlsx-document.extractor.ts`
- Create: `dfkorea-backend/src/tenders/documents/fixtures/` test documents
- Modify: `dfkorea-backend/package.json`
- Modify: `dfkorea-backend/package-lock.json`

**Interfaces:**
- Produces: `TenderDocumentTextExtractor.extract(input): Promise<ExtractedDocument>`.
- `ExtractedDocument` is `{ status: 'EXTRACTED'|'PARTIAL'; blocks: Array<TextBlock|TableBlock>; metadata: { pages?: number; sheets?: string[]; hiddenSheets?: string[] } }`.
- Blocks preserve ordinal and location labels; no extractor writes files or DB records.

- [x] **Step 1: Add small fixture documents and failing extraction contracts**

Each fixture contains the literal facts `소비전력 50W 이하`, `광효율 130 lm/W 이상`, `고효율 인증 필수`, and a two-column table. The expected blocks are hand-written literals, not generated by another parser.

```ts
it.each(['sample.hwp', 'sample.hwpx', 'sample.pdf', 'sample.docx', 'sample.xlsx'])(
  'preserves requirement text and table order from %s', async filename => {
    const result = await extractor.extract(loadFixture(filename))
    expect(flattenBlocks(result.blocks)).toContain('소비전력 50W 이하')
    expect(result.blocks.some(block => block.kind === 'table')).toBe(true)
  },
)
```

Also test encrypted HWP/PDF, corrupt containers, image-only PDF, decompressed text >10 MiB, ZIP entry-count/ratio limits, and timeout. Tests must assert normalized status/error behavior rather than third-party exception text.

- [x] **Step 2: Run and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/documents/tender-document-extractor.spec.ts`

Expected: FAIL because extractor modules and dependencies are absent.

- [x] **Step 3: Install pinned parsers**

Run: `cd dfkorea-backend && npm install --save-exact hwp-convert@1.13.0 pdfjs-dist mammoth exceljs`

Read each package's Node entrypoint and isolate it behind the format adapter. Do not expose third-party ASTs outside `extractors/`.

- [x] **Step 4: Implement format adapters and dispatcher**

The dispatcher chooses by detected format from Task 3. Normalize whitespace without joining table cells ambiguously. Apply entry/decompression/text limits before building large strings. Map encrypted, unsupported, corrupt, partial, and timeout outcomes to stable application codes.

- [x] **Step 5: Run extraction tests and verify GREEN**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/documents/tender-document-extractor.spec.ts`

- [x] **Step 6: Run dependency audit and production build**

Run: `cd dfkorea-backend && npm audit --omit=dev`

Run: `cd dfkorea-backend && npm run build`

Any high/critical runtime finding blocks this dependency set; replace the affected parser while preserving the extractor contract and rerun the fixture suite.

- [x] **Step 7: Commit**

```bash
git add dfkorea-backend/package.json dfkorea-backend/package-lock.json dfkorea-backend/src/tenders/documents
git commit -m "feat: extract tender requirement documents"
```

---

### Task 5: Deterministic requirement parsing and suitability scoring

**Files:**
- Create: `dfkorea-backend/src/tenders/domain/tender-requirement.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-requirement-parser.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-requirement-parser.spec.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-suitability-analyzer.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-suitability-analyzer.spec.ts`

**Interfaces:**
- Produces: `TenderRequirementParser.parse(enrichment, documents): ParsedTenderRequirements`.
- Produces: `TenderSuitabilityAnalyzer.analyze(requirements, profile, products, now): TenderSuitabilityResult`.
- `TenderSuitabilityResult` includes `suitability`, nullable `specificationScore`, four counts, `certifications`, `participationConditions`, `evidence`, and input fingerprints.

- [x] **Step 1: Write parser tests that fail on missing normalization behavior**

Use literal cases for W, lm/W, K, IP, CRI, dimensions, `이상/이하/초과/미만`, Korean certification aliases, regional limits, industry/license codes, SME, direct production, G2B registration, performance conditions, and lower-limit percentages. Add a conflict case where structured corrected data overrides an older attachment while preserving a conflict evidence item.

- [x] **Step 2: Run parser tests and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/domain/tender-requirement-parser.spec.ts`

- [x] **Step 3: Implement parser as small rule modules**

Keep unit parsing, certification aliases, eligibility phrases, and bid-formula phrases in separate exported pure functions. Only explicit obligation words or structured restriction fields set `required: true`; unsupported prose produces an evidence note and `UNKNOWN`, never a guessed pass.

- [x] **Step 4: Write scoring tests and verify RED**

```ts
it.each([
  { score: 80, unknown: 0, hardFailure: false, want: 'RECOMMENDED' },
  { score: 80, unknown: 1, hardFailure: false, want: 'REVIEW' },
  { score: 50, unknown: 0, hardFailure: false, want: 'REVIEW' },
  { score: 49, unknown: 0, hardFailure: false, want: 'DIFFICULT' },
  { score: 100, unknown: 0, hardFailure: true, want: 'DIFFICULT' },
])('applies the documented status precedence', input => {
  expect(analyzeFixture(input).suitability).toBe(input.want)
})
```

Add a test with Product A satisfying wattage only and Product B satisfying certification only; the result must not report one fully matching procurement item.

- [x] **Step 5: Implement comparison and status precedence**

Required specification weight is 2 and reference weight is 1. `UNSATISFIED` hard participation/certification wins, then unknown forces `REVIEW`, then score `<50` is `DIFFICULT`, `50..79` is `REVIEW`, and `>=80` is `RECOMMENDED`. No comparable specifications returns null score and `REVIEW` unless a hard failure already makes it `DIFFICULT`.

- [x] **Step 6: Run domain tests and verify GREEN**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/domain/tender-requirement-parser.spec.ts tenders/domain/tender-suitability-analyzer.spec.ts`

- [x] **Step 7: Commit**

```bash
git add dfkorea-backend/src/tenders/domain/tender-requirement.ts dfkorea-backend/src/tenders/domain/tender-requirement-parser.ts dfkorea-backend/src/tenders/domain/tender-requirement-parser.spec.ts dfkorea-backend/src/tenders/domain/tender-suitability-analyzer.ts dfkorea-backend/src/tenders/domain/tender-suitability-analyzer.spec.ts
git commit -m "feat: score tender suitability with evidence"
```

---

### Task 6: Award-result backfill and bid-price statistics

**Files:**
- Create: `dfkorea-backend/src/tenders/adapters/g2b-award.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/g2b-award.adapter.spec.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-award-collector.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-award-collector.service.spec.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-price-analyzer.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-price-analyzer.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`

**Interfaces:**
- Produces: `G2bAwardAdapter.fetchWindow(window, cursor): Promise<AwardPage>` using official `https://apis.data.go.kr/1230000/as/ScsbidInfoService` by default.
- Produces: `TenderAwardCollectorService.startBackfill(now)`, `collectIncremental(now)`, and `getStatus()`.
- Produces: `TenderPriceAnalyzer.analyze(requirements, awards): TenderPriceAnalysis`.

- [x] **Step 1: Write failing award adapter tests with full provider fixtures**

Assert mapping for final G2B goods results, decimal-string precision, cancellation/rebid/failure exclusion, page cursors, and absence of bidder identity in returned normalized data.

- [x] **Step 2: Write failing collector lease and resume tests**

Use a real repository/service boundary where possible. Assert monthly windows cover exactly `[now-2 years, now]`, cursor commits only after result upserts, duplicate identities update without duplicate rows, and a second replica cannot claim the same window.

- [x] **Step 3: Run and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/adapters/g2b-award.adapter.spec.ts tenders/services/tender-award-collector.service.spec.ts`

- [x] **Step 4: Implement adapter and collector**

Reuse the same `PUBLIC_DATA_SERVICE_KEY`, pacing, safe retry classification, and relay fallback pattern. Filter LED-related goods before persistence and store only the schema from Task 1. Process one monthly page budget per scheduled tick so ordinary tender collection retains capacity.

- [x] **Step 5: Write price-statistic tests and verify RED**

Hand-calculate fixtures for `basis=100000000`, historical adjustment median `0.9982`, and winning-rate median `0.8886`; expect `88700052` before display rounding. Test IQR outliers and sample boundaries 14/15/29/30/99/100. Test matching fallback order and reject mixed unit/total contracts.

- [x] **Step 6: Implement price analysis**

Use decimal arithmetic rather than JS float for money. Produce official range only when all variables are available; missing A-value or special formula produces `FORMULA_REVIEW_REQUIRED`. Statistics return median, P25/P75, sample count, matching level, period, and confidence.

- [x] **Step 7: Run and verify GREEN**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/adapters/g2b-award.adapter.spec.ts tenders/services/tender-award-collector.service.spec.ts tenders/domain/tender-price-analyzer.spec.ts`

- [x] **Step 8: Commit**

```bash
git add dfkorea-backend/src/tenders/adapters/g2b-award.adapter.ts dfkorea-backend/src/tenders/adapters/g2b-award.adapter.spec.ts dfkorea-backend/src/tenders/services/tender-award-collector.service.ts dfkorea-backend/src/tenders/services/tender-award-collector.service.spec.ts dfkorea-backend/src/tenders/domain/tender-price-analyzer.ts dfkorea-backend/src/tenders/domain/tender-price-analyzer.spec.ts dfkorea-backend/src/tenders/tenders.module.ts
git commit -m "feat: analyze historical tender bid prices"
```

---

### Task 7: Analysis orchestration, scheduler, review, and API response

**Files:**
- Create: `dfkorea-backend/src/tenders/dto/tender-analysis.dto.ts`
- Create: `dfkorea-backend/src/tenders/dto/tender-analysis.dto.spec.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-analysis.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-analysis.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-ingestion.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-ingestion.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-scheduler.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-scheduler.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-query.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-query.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`

**Interfaces:**
- Produces: `TenderAnalysisService.processDue(now, limit)`, `reanalyze(tenderId, now)`, `getAnalysis(tenderId)`, and `saveReview(tenderId, dto, adminId)`.
- Produces: analysis/review/backfill routes from the design and compact list summary `{ status, suitability, specificationScore, unknownCount, analyzedAt }`.

- [ ] **Step 1: Write failing orchestration tests**

Name the breaks: collection does not enqueue a changed fingerprint, stale worker overwrites a newer result, one broken document fails the whole analysis, profile/product updates are not detected, review remains current after fingerprint changes, and compact API accidentally exposes full extracted text. Add an authenticated application contract covering profile PUT → analysis queue → analysis GET → review POST, with complete repository/provider fixtures.

- [ ] **Step 2: Run and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/services/tender-analysis.service.spec.ts tenders/services/tender-ingestion.service.spec.ts tenders/services/tender-query.service.spec.ts tenders/tenders.controller.spec.ts && npm run test:tender:contract`

- [ ] **Step 3: Implement lease-based orchestration**

Claim due analysis rows with `FOR UPDATE SKIP LOCKED`, a random claim token, and a five-minute lease. Fetch/extract each document independently, persist normalized blocks, parse requirements, load profile/products, compute fingerprints, suitability, and price, then update only when claim token and input fingerprint still match. Persist `PARTIAL` when at least one useful fact exists and any source failed.

- [ ] **Step 4: Connect collection and scheduling**

After a relevant tender upsert, compare the content fingerprint and mark analysis pending only when changed. `refreshStaleAnalyses()` computes one deterministic fingerprint from sorted product IDs and `updatedAt` values, then marks analyses whose product fingerprint differs as pending; the scheduler runs this check before each hourly analysis sweep. Profile replacement marks current analyses pending in the same transaction. Add a minute task for small analysis batches, a nightly incremental award task, and a small backfill-resume task. Preserve existing collection/mail tasks and destroy every new cron task in `onModuleDestroy`.

- [ ] **Step 5: Implement API DTOs and review semantics**

`POST /tenders/:id/analysis` returns `202`-style current job state without waiting on document parsing. Review notes are 0..2000 trimmed characters. The authenticated admin identity and current analysis fingerprint are recorded. A fingerprint mismatch returns current data as `reviewed: false` while retaining the old review row.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `cd dfkorea-backend && npm test -- --runInBand tenders/services/tender-analysis.service.spec.ts tenders/services/tender-ingestion.service.spec.ts tenders/services/tender-scheduler.service.spec.ts tenders/services/tender-query.service.spec.ts tenders/tenders.controller.spec.ts`

- [ ] **Step 7: Run tender contract tests**

Run: `cd dfkorea-backend && npm run test:tender:contract`

- [ ] **Step 8: Commit**

```bash
git add dfkorea-backend/src/tenders/dto dfkorea-backend/src/tenders/services dfkorea-backend/src/tenders/tenders.controller.ts dfkorea-backend/src/tenders/tenders.controller.spec.ts dfkorea-backend/src/tenders/tenders.module.ts dfkorea-backend/test/tenders.contract-spec.ts dfkorea-backend/test/tender-app-integration.spec.ts
git commit -m "feat: orchestrate tender suitability analysis"
```

---

### Task 8: Admin analysis UI and company-profile editor

**Files:**
- Create: `led-lighting-website/src/components/admin/tenders/TenderSuitabilityBadge.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderSuitabilityBadge.spec.ts`
- Create: `led-lighting-website/src/components/admin/tenders/TenderAnalysisSummary.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderAnalysisSummary.spec.ts`
- Create: `led-lighting-website/src/components/admin/tenders/TenderRequirementTable.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderPriceAnalysis.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderCompanyProfileModal.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderCompanyProfileModal.spec.ts`
- Modify: `led-lighting-website/src/types/tender.ts`
- Modify: `led-lighting-website/src/api/tenders.ts`
- Modify: `led-lighting-website/src/api/tenders.spec.ts`
- Modify: `led-lighting-website/src/components/admin/TenderManagement.vue`
- Create: `led-lighting-website/src/components/admin/TenderManagement.spec.ts`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderList.vue`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderList.spec.ts`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderDetailModal.vue`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderDetailModal.spec.ts`

**Interfaces:**
- Consumes: compact analysis summaries and detailed analysis/profile APIs from Task 7.
- Produces: reusable badge, summary, requirement-table, price-analysis, and profile-modal components under the existing common/admin component hierarchy.

- [ ] **Step 1: Write failing type/API and badge tests**

Assert API paths and payloads, Korean labels for all processing/suitability states, and visible text plus icon so color is never the sole signal.

- [ ] **Step 2: Run and verify RED**

Run: `cd led-lighting-website && npm test -- src/api/tenders.spec.ts src/components/admin/tenders/TenderSuitabilityBadge.spec.ts`

- [ ] **Step 3: Implement types, API client, and badge**

Use decimal strings for money and explicit unions matching backend enums. Keep `Tender` backward-compatible by making `analysisSummary` nullable, not optional.

- [ ] **Step 4: Write failing detail-layout tests**

Mount the real detail modal. Assert the top summary renders before requirement evidence, `82%` is accompanied by counts, unknown items say `확인 필요`, statistics include period/sample/confidence, and no product name from the hidden matched snapshot appears. Add loading, partial, failed, stale, and no-profile states.

- [ ] **Step 5: Implement the approved 1120px responsive detail layout**

Use existing `BaseModal`, `BaseCard`, and `BaseButton`. Fetch analysis when the modal opens for a new tender; protect against out-of-order responses with a monotonically increasing request generation. Desktop uses summary cards plus left analysis/right price columns; mobile uses one column. `다시 분석`, `공식 원문`, and `검토 완료` remain keyboard accessible.

- [ ] **Step 6: Write failing profile-modal and management tests**

Assert repeated qualification rows, expiry validation, duplicate codes, full replacement payload, save failure preservation, stale request isolation, and a toolbar `회사 자격 설정` action. Test that list badges update after reanalysis without reloading the page.

- [ ] **Step 7: Implement profile modal and list integration**

Keep draft state local to the modal and update the parent only after a successful PUT. Display how many current analyses became stale and poll compact status only while recomputation is active. Stop polling on unmount or modal close.

- [ ] **Step 8: Run frontend focused tests and verify GREEN**

Run: `cd led-lighting-website && npm test -- src/api/tenders.spec.ts src/components/admin/TenderManagement.spec.ts src/components/admin/tenders/TenderSuitabilityBadge.spec.ts src/components/admin/tenders/TenderAnalysisSummary.spec.ts src/components/admin/tenders/TenderCompanyProfileModal.spec.ts src/components/admin/tenders/TenderList.spec.ts src/components/admin/tenders/TenderDetailModal.spec.ts`

- [ ] **Step 9: Run type-check and lint for changed frontend files**

Run: `cd led-lighting-website && npm run type-check`

Run: `cd led-lighting-website && npx eslint src/api/tenders.ts src/types/tender.ts src/components/admin/TenderManagement.vue src/components/admin/TenderManagement.spec.ts 'src/components/admin/tenders/Tender*.vue' 'src/components/admin/tenders/Tender*.spec.ts'`

- [ ] **Step 10: Commit**

```bash
git add led-lighting-website/src/types/tender.ts led-lighting-website/src/api/tenders.ts led-lighting-website/src/api/tenders.spec.ts led-lighting-website/src/components/admin/TenderManagement.vue led-lighting-website/src/components/admin/TenderManagement.spec.ts led-lighting-website/src/components/admin/tenders
git commit -m "feat: show tender suitability analysis"
```

---

### Task 9: Deployment configuration, documentation, and end-to-end verification

**Files:**
- Modify: `dfkorea-backend/.env.example`
- Modify: `DEPLOYMENT.md`
- Modify: `docs/menus/tenders.md`
- Modify: `database-schema.md`

**Interfaces:**
- Produces: one documented production setup step: approve G2B award service for the existing public-data key.
- Produces: deployable backend/frontend artifacts with no new required environment variable.

- [ ] **Step 1: Update human and deployment documentation**

In `.env.example`, document optional `G2B_AWARD_API_BASE_URL=https://apis.data.go.kr/1230000/as/ScsbidInfoService` as an override with a built-in default, not a required setting. In `DEPLOYMENT.md`, add only the separate award-service approval and safe initial backfill sequence. Update `docs/menus/tenders.md` under every required heading, accurately separating G2B support from K-apt best effort and OCR exclusion.

- [ ] **Step 2: Run backend verification**

Run: `cd dfkorea-backend && npm run test:ci`

Expected: lint, all Jest suites, contract tests, type-check, clean build, compiled process probe, and compiled TypeORM discovery pass.

- [ ] **Step 3: Run frontend verification**

Run: `cd led-lighting-website && npm test`

Run: `cd led-lighting-website && npm run type-check`

Run: `cd led-lighting-website && npm run build`

Expected: all tests pass, type-check exits 0, and the production Nuxt build verifies the G2B relay artifact.

- [ ] **Step 4: Run migration integration if disposable PostgreSQL is available**

Run: `cd dfkorea-backend && npm run test:tender:integration`

Expected: new migration, concurrent lease, bigint/numeric, and full AppModule flow pass. If a disposable DB is unavailable, report this exact unverified boundary and do not run against production or a remote shared DB.

- [ ] **Step 5: Inspect the UI at desktop and mobile sizes**

Use the local production frontend build against a local fixture backend. Verify 1440×900 and 390×844: no clipped modal content, price numbers fit, evidence text wraps, focus remains trapped, close restores focus, and no hidden product name is rendered.

- [ ] **Step 6: Check secrets and persisted-data exclusions**

Run: `rg -n "PUBLIC_DATA_SERVICE_KEY=.+|G2B_DATA_SERVICE_KEY=.+|serviceKey=.+|bidderBusiness|providerPayload|bytea" dfkorea-backend led-lighting-website docs --glob '!package-lock.json' --glob '!*.spec.ts'`

Expected: no secret values, no award bidder identity/provider payload persistence, and no tender-document binary column. Expected legitimate mentions are empty/example environment variable names and unrelated quote attachment BYTEA documentation.

- [ ] **Step 7: Request code review and resolve findings**

Provide the approved spec, this plan, and the complete implementation commit range. Require checks for false-positive participation recommendations, formula misuse, document-fetch SSRF/archive limits, stale worker writes, precision loss, data minimization, and regression of existing tender mail/collection.

- [ ] **Step 8: Commit final documentation and verification fixes**

```bash
git add dfkorea-backend/.env.example DEPLOYMENT.md docs/menus/tenders.md database-schema.md
git commit -m "docs: complete tender analysis rollout"
```

- [ ] **Step 9: Prepare deployment without starting the historical backfill**

Confirm the existing public-data key has approval for the G2B award service. Push the reviewed commits to `main` only when deployment is explicitly authorized. Let migrations and application deploy first, verify health and one live analysis sample, then start the two-year backfill from the admin action and monitor its persisted progress.

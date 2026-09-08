# LH Tender Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect LH goods and supplied-material LED lighting tenders from the public e-bid HTML interface and feed them through the existing listing, notification, and document-analysis flows.

**Architecture:** A source adapter performs bounded sequential list/detail requests and emits provider-neutral tenders. A separate enrichment adapter turns only persisted, validated LH detail metadata into structured evidence and secure document references; the shared fetcher performs the required LH form POST and the extractor handles one-level ZIP bundles. Existing ingestion, classifier, mail, and analysis services remain the orchestration layer.

**Tech Stack:** NestJS 10, TypeScript, Jest, native Fetch API, Vue 3/Nuxt, Vitest

**Spec:** `docs/superpowers/specs/2026-09-08-lh-tender-collector-design.md`

## Global Constraints

- Collect only LH work types `30` (goods) and `40` (supplied materials).
- Query deadlines from seven days before collection through 180 days after collection.
- Default request interval is 1,500ms and all LH requests are sequential.
- A missing required list/detail structure is `STRUCTURE_CHANGED`, never an empty success.
- Document downloads allow only issued `LH_PAGE` references to `https://ebid.lh.or.kr/ebid.framework.download.dev`.
- ZIP processing expands one level only and keeps the existing 20 MiB input, 40 MiB expanded, and 4,096 entry limits.
- LH collection is disabled unless `LH_TENDER_ENABLED=true`.
- No database migration is required.

---

### Task 1: LH list and detail source adapter

**Files:**
- Create: `dfkorea-backend/src/tenders/adapters/lh-html.ts`
- Create: `dfkorea-backend/src/tenders/adapters/lh-tender.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/lh-tender.adapter.spec.ts`
- Create: `dfkorea-backend/src/tenders/adapters/fixtures/lh-notices.html`
- Create: `dfkorea-backend/src/tenders/adapters/fixtures/lh-detail-material.html`
- Modify: `dfkorea-backend/src/tenders/domain/tender.enums.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/public-api-client.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`

**Interfaces:**
- Produces: `LhTenderAdapter implements TenderSourceAdapter` with `source = TenderSource.LH`.
- Produces: `LhTenderAdapterConfig { enabled: boolean; baseUrl: string; requestIntervalMs: number; maximumPages?: number; maximumDetails?: number }`.
- Produces: persisted `rawData.lh` containing `workTypeCode`, `emergencyOrder`, `detailPath`, `basisAmount`, and `attachments: Array<{ sequence: string; displayName: string; savedName: string }>`.

- [ ] **Step 1: Write failing adapter tests**

Add tests proving disabled configuration returns a successful empty result without a request; enabled collection posts work types 30 and 40, parses and deduplicates rows, skips non-lighting titles before detail requests, maps a valid detail to literal normalized fields, paginates sequentially, and reports `STRUCTURE_CHANGED` or bounded partial failures for malformed/oversized input.

- [ ] **Step 2: Run the tests and verify RED**

Run `npm test -- --runInBand src/tenders/adapters/lh-tender.adapter.spec.ts`. Expected failure: the LH adapter module and enum member do not exist.

- [ ] **Step 3: Implement the bounded HTML client and adapter**

Use strict table/header and label/value parsing rather than arbitrary DOM evaluation. POST URL-encoded search forms, use GET detail URLs, cap every body, validate every redirect stays on `ebid.lh.or.kr`, and wait between sequential requests. Emit sanitized `TenderOperationFailure` entries without URLs or HTML.

- [ ] **Step 4: Run focused and existing adapter tests**

Run `npm test -- --runInBand src/tenders/adapters/lh-tender.adapter.spec.ts src/tenders/adapters/tender-adapters.spec.ts`. Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Commit message: `feat: collect LH lighting tender notices`

### Task 2: LH enrichment, secure download, and ZIP analysis

**Files:**
- Create: `dfkorea-backend/src/tenders/adapters/lh-enrichment.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/lh-enrichment.adapter.spec.ts`
- Create: `dfkorea-backend/src/tenders/documents/extractors/zip-document.extractor.ts`
- Modify: `dfkorea-backend/src/tenders/domain/tender-enrichment.ts`
- Modify: `dfkorea-backend/src/tenders/domain/tender-price-analyzer.ts`
- Modify: `dfkorea-backend/src/tenders/documents/tender-document-fetcher.ts`
- Modify: `dfkorea-backend/src/tenders/documents/tender-document-fetcher.spec.ts`
- Modify: `dfkorea-backend/src/tenders/documents/tender-document-extraction.worker.ts`
- Modify: `dfkorea-backend/src/tenders/documents/tender-document-extractor.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-analysis.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-analysis.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`

**Interfaces:**
- Consumes: `rawData.lh` from Task 1.
- Produces: `LH_TENDER_ENRICHMENT_ADAPTER` and evidence source `LH_PAGE`.
- Produces: issued identities `LH:<noticeId>:<revision>:<sequence>` and canonical attachment URL metadata.
- Produces: `TenderDocumentFormat` member `ZIP` and one-level extraction into the existing `ExtractedDocument` shape.

- [ ] **Step 1: Write failing enrichment and downloader tests**

Prove LH enrichment rejects non-LH and malformed raw metadata without network access, emits basis amount evidence and exact document identities, and never invents a lower-limit rate or pricing context. Prove the shared fetcher sends the exact form POST only for a valid issued LH reference and rejects host, path, identity, query-key, or method-confusion variants.

- [ ] **Step 2: Run focused tests and verify RED**

Run `npm test -- --runInBand src/tenders/adapters/lh-enrichment.adapter.spec.ts src/tenders/documents/tender-document-fetcher.spec.ts`. Expected failure: LH enrichment/source support is absent.

- [ ] **Step 3: Implement enrichment and secure form download**

Add `LH_PAGE` to evidence/document source unions. Encode only `filespec=bidinfo`, `filename`, `savedname`, and an empty `bidnum` in the form body. Keep query metadata in the issued reference for validation but do not send it as a GET query to LH.

- [ ] **Step 4: Write failing ZIP extraction tests**

Use in-memory literal fixture archives to prove a top-level supported document contributes text/table blocks, while nested ZIP, traversal names, encrypted members, too many entries, and expanded-byte excess fail with existing bounded error codes.

- [ ] **Step 5: Run ZIP tests and verify RED**

Run `npm test -- --runInBand src/tenders/documents/tender-document-extractor.spec.ts`. Expected failure: generic ZIP is unsupported.

- [ ] **Step 6: Implement one-level ZIP extraction and LH analysis routing**

Reuse `readBoundedZip`, detect supported inner document signatures, extract into bounded child contexts, prefix locations with the archive member name, and mark partial when unsupported members coexist with useful supported documents. Inject and select the LH enrichment adapter; include LH tenders in catch-up analysis queries. Keep award-history queries empty for LH.

- [ ] **Step 7: Run focused document and analysis tests**

Run `npm test -- --runInBand src/tenders/adapters/lh-enrichment.adapter.spec.ts src/tenders/documents/tender-document-fetcher.spec.ts src/tenders/documents/tender-document-extractor.spec.ts src/tenders/services/tender-analysis.service.spec.ts`. Expected: PASS.

- [ ] **Step 8: Commit Task 2**

Commit message: `feat: analyze LH tender documents`

### Task 3: Admin UI, configuration, documentation, and whole-feature verification

**Files:**
- Modify: `led-lighting-website/src/types/tender.ts`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderFilterPanel.vue`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderList.vue`
- Modify: `led-lighting-website/src/components/admin/TenderManagement.spec.ts`
- Modify: `dfkorea-backend/.env.example`
- Modify: `docs/menus/tenders.md`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Consumes: API source value `LH` and existing collection-summary response.
- Produces: visible label `LH` and an LH source filter without changing query parameter names.

- [ ] **Step 1: Write failing UI tests**

Add a collection result containing `LH`, select the LH filter, and render an LH tender. Assert the user sees `LH`, the source query is `LH`, and a failed LH source does not use the G2B-specific partial-failure copy.

- [ ] **Step 2: Run the UI test and verify RED**

Run `npm test -- src/components/admin/TenderManagement.spec.ts`. Expected failure: the LH source type, filter, or label is absent.

- [ ] **Step 3: Implement the UI and operating configuration**

Extend the source union and shared labels/options. Add the three LH environment variables with safe defaults. Document enabling, request load, collection limits, direct-collection limitations, structured/ZIP document support, monitoring, and rollback by setting `LH_TENDER_ENABLED=false`.

- [ ] **Step 4: Run frontend verification**

Run `npm test -- src/components/admin/TenderManagement.spec.ts && npm run type-check && npm run build`. Expected: PASS.

- [ ] **Step 5: Run backend verification**

Run `npm run test:ci`. Expected: PASS.

- [ ] **Step 6: Perform a disabled live smoke test**

Instantiate the production adapter with `enabled=false` and confirm zero network calls and an empty successful result. Do not run repeated production-site collection in CI.

- [ ] **Step 7: Commit Task 3**

Commit message: `feat: expose LH tenders in administration`

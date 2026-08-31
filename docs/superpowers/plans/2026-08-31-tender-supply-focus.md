# Tender Supply Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 캘린더와 메일을 LED 물품 납품 및 공개 MAS 구매공고 중심으로 전환하면서 기존 공고와 발송 이력을 보존한다.

**Architecture:** 별도 `TenderOpportunityClassifier`가 정규화된 공고와 나라장터 면허제한정보를 받아 영속 기회 유형을 결정한다. 조회와 메일은 동일한 영속 유형을 사용해 참여 가능 공고만 선택하고, Nuxt 화면과 메일 렌더러는 공통 의미의 기회 배지를 표시한다.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL, Jest, Nuxt 4, Vue 3, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-08-31-tender-supply-focus-design.md`

## Global Constraints

- 기존 `tenders` 행, 수신 주소, 발송 이력은 삭제하지 않는다.
- 기본 관리자 조회와 메일 대상은 `GOODS_SUPPLY`, `MAS`만이다.
- 나라장터 물품 공고도 `전기공사업` 면허제한이 있으면 제외한다.
- 제목에 `공사`가 있어도 공식 업무구분이 물품이고 전기공사업 제한이 없으면 물품으로 유지한다.
- K-apt `codeClassifyType2`는 `02=공사`, `03=용역`, `04=물품`으로 매핑한다.
- 종합쇼핑몰 등록 품목·납품요구 정보는 이번 메일 대상에 포함하지 않는다.
- DB 변경에서 `database-schema.md`, 메뉴 변경에서 `docs/menus/tenders.md`를 갱신한다.
- 모든 프로덕션 동작 변경은 실패 테스트 확인 후 구현한다.

---

### Task 1: Opportunity classifier and official adapter enrichment

**Files:**
- Modify: `dfkorea-backend/src/tenders/domain/tender.enums.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-opportunity-classifier.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-opportunity-classifier.spec.ts`
- Modify: `dfkorea-backend/src/tenders/domain/normalized-tender.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/g2b-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/kapt-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/kepco-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/fixtures/g2b-notices.json`
- Modify: `dfkorea-backend/src/tenders/adapters/fixtures/kapt-notices.json`
- Modify: `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`

**Interfaces:**
- Produces: `TenderOpportunityType` enum with `GOODS_SUPPLY`, `MAS`, `EXCLUDED_CONSTRUCTION`, `EXCLUDED_NON_SUPPLY`.
- Produces: `TenderOpportunityClassifier.classify(input): { type: TenderOpportunityType; reasons: string[] }`.
- Produces: `NormalizedTender.licenseLimits: Array<{ name: string; permittedIndustries: string }>`; K-apt and KEPCO populate an empty array until their official APIs expose an equivalent field.

- [x] **Step 1: Write failing classifier tests**

Add literal cases proving: construction is excluded; a goods title containing `공사 관급자재 구입` remains `GOODS_SUPPLY`; goods with `전기공사업/0037` in a license limit is excluded; `다수공급자계약 LED 조명기구` becomes `MAS`; and service becomes `EXCLUDED_NON_SUPPLY`.

- [x] **Step 2: Run the classifier test and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/domain/tender-opportunity-classifier.spec.ts`

Expected: FAIL because the enum and classifier do not exist.

- [x] **Step 3: Implement the minimal classifier and run GREEN**

Implement the priority in the spec. Match MAS using `다수\s*공급자\s*계약` or the independent ASCII word `MAS`; match an electrical-construction restriction across both license name and permitted industries using `전기공사업`.

Run the focused classifier test and expect PASS.

- [x] **Step 4: Write failing adapter tests**

For G2B, make the client return four operation results and assert `getBidPblancListInfoLicenseLimit` is called with the same `inqryDiv=1`, `inqryBgnDt`, `inqryEndDt`, `type=json` window and that matching `bidNtceNo`/`bidNtceOrd` rows populate `licenseLimits`. For K-apt, add literal rows proving `codeClassifyType2` values `02`, `03`, `04`, and an unknown code map to construction, service, goods, and other.

- [x] **Step 5: Run adapter tests and verify RED**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts`

Expected: FAIL because G2B does not fetch license limits and K-apt always returns `OTHER`.

- [x] **Step 6: Implement adapter enrichment and run GREEN**

Fetch license limits once per collection window, group by `${bidNtceNo}:${bidNtceOrd}`, and attach sanitized `lcnsLmtNm`/`permsnIndstrytyList` values. Do not place request URLs or service keys in `rawData`. Implement the exact K-apt mapping from Global Constraints and run both focused suites.

- [x] **Step 7: Commit Task 1**

Commit message: `feat: classify supply tender opportunities`

---

### Task 2: Persist and enforce opportunity eligibility

**Files:**
- Modify: `dfkorea-backend/src/tenders/entities/tender.entity.ts`
- Modify: `dfkorea-backend/src/tenders/entities/tender.entities.spec.ts`
- Create: `dfkorea-backend/src/migrations/1788135000000-AddTenderOpportunityType.ts`
- Create: `dfkorea-backend/src/migrations/tender-opportunity.migrations.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-ingestion.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-ingestion.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/dto/tender-query.dto.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-query.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-query.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-mail.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-mail.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`
- Modify: `database-schema.md`

**Interfaces:**
- Consumes: `TenderOpportunityClassifier` and `NormalizedTender.licenseLimits` from Task 1.
- Produces: `Tender.opportunityType`, `Tender.opportunityReasons`, and matching fields in `TenderSummaryDto`.
- Produces: shared `MAIL_ELIGIBLE_OPPORTUNITY_TYPES` or an equivalent single domain helper used by both query and mail selection.

- [x] **Step 1: Write failing persistence and ingestion tests**

Assert TypeORM metadata contains indexed non-null `opportunityType` and non-null JSONB `opportunityReasons`. Assert ingestion persists classifier output on create and updates both fields when an existing revision is recollected.

- [x] **Step 2: Run focused tests and verify RED**

Run entity and ingestion spec files; expect missing fields/classifier integration failures.

- [x] **Step 3: Implement entity, migration, ingestion, and run GREEN**

The migration adds both columns without dropping data, backfills existing rows using procurement type plus K-apt `rawData->>'codeClassifyType2'`, detects MAS text for existing goods, then sets non-null defaults and creates `IDX_tender_opportunity_type`. Down migration removes only the new index and columns. Register the classifier provider and persist its result on every create/update.

- [x] **Step 4: Write failing query and mail tests**

Assert calendar/list builders add `opportunityType IN (:...eligibleOpportunityTypes)` and safe DTOs expose both new fields. Assert mail creates items only for eligible tenders and excludes previously queued pending items whose related tender is now excluded.

- [x] **Step 5: Run focused tests and verify RED**

Run query and mail service specs; expect absent filters and response fields.

- [x] **Step 6: Implement shared eligibility enforcement and run GREEN**

Use exactly `GOODS_SUPPLY` and `MAS` as eligible types. Apply the predicate to calendar, list, and mail selection, including existing mail items. Do not change recipient, dispatch-slot, retry, or sent-history semantics.

- [x] **Step 7: Update schema documentation and commit Task 2**

Document the columns, index, backfill, and preservation behavior in `database-schema.md`.

Commit message: `feat: enforce supply-focused tender delivery`

---

### Task 3: Show supply and MAS badges in admin and mail

**Files:**
- Create: `led-lighting-website/src/components/admin/tenders/TenderOpportunityBadge.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderOpportunityBadge.spec.ts`
- Modify: `led-lighting-website/src/types/tender.ts`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderList.vue`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderList.spec.ts`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderDetailModal.vue`
- Modify: `led-lighting-website/src/components/admin/tenders/TenderDetailModal.spec.ts`
- Modify: `dfkorea-backend/src/tenders/mail/tender-mail-renderer.ts`
- Modify: `dfkorea-backend/src/tenders/mail/tender-mail-renderer.spec.ts`
- Modify: `docs/menus/tenders.md`

**Interfaces:**
- Consumes: API `opportunityType` and `opportunityReasons` from Task 2.
- Produces: `TenderOpportunityBadge` rendering `📦 물품 납품` or `🧾 MAS`.

- [ ] **Step 1: Write failing component and renderer tests**

Assert the common badge labels both eligible types, list and detail render the badge, and HTML/text mail output contains the same label plus opportunity reasons without exposing `rawData`.

- [ ] **Step 2: Run focused tests and verify RED**

Run the new badge/list/detail Vitest files and backend mail-renderer Jest file; expect failures for missing fields/component/content.

- [ ] **Step 3: Implement the common badge and integrations**

Use the existing common visual language: teal package badge for goods and indigo document badge for MAS. Keep `TenderRelevanceBadge` alongside it. Add accessible text, render reasons in the detail and mail, and avoid duplicating label maps across list/detail by keeping label logic in the common badge.

- [ ] **Step 4: Run focused tests and GREEN**

Run the focused frontend and backend renderer tests and expect PASS.

- [ ] **Step 5: Update menu documentation and commit Task 3**

Update `docs/menus/tenders.md` with completed supply-focused behavior, MAS boundary, K-apt mapping, and the operational need to confirm the current OpenAPI license-limit response.

Commit message: `feat: display supply tender opportunity badges`

---

### Task 4: Full verification

**Files:**
- Modify only if verification reveals a defect in files already listed above.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: verified build and regression evidence.

- [ ] **Step 1: Run backend CI verification**

Run: `cd dfkorea-backend && npm run test:ci`

Expected: lint, unit, contract, TypeScript, production-process, TypeORM discovery, and build checks all PASS.

- [ ] **Step 2: Run frontend verification**

Run: `cd led-lighting-website && npm test && npm run type-check && npm run build`

Expected: Vitest, Nuxt typecheck, and production build all PASS.

- [ ] **Step 3: Inspect migration safety and repository state**

Confirm the migration contains no `DROP TABLE`, no deletion/update of mail history, and only backfills the two new tender columns. Confirm `git diff --check` is clean.

- [ ] **Step 4: Commit any verification-only correction**

If a correction was required, commit it as `fix: complete supply tender verification`; otherwise record the passing evidence without an empty commit.

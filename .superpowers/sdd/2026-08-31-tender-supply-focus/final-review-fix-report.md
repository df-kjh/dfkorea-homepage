# Final review fix report

## Status

- Result: PASS
- Scope: the four findings in `final-review-fix-brief.md` only
- Data safety: no tender, recipient, dispatch, delivery, or mail-item row is deleted; no destructive migration was added
- Schema: no DDL change was required because `tender_sync_runs.status` is already `varchar`; its documented logical values now include `PARTIAL`

## Finding 1: mixed retry history contamination

### Root cause

`sendRetry` filtered the provider payload but kept excluded mail items linked to the retry delivery until the post-ack success transaction. Unknown provider outcomes and stale-lease recovery select items by `lastDeliveryId`, so an excluded item could incorrectly become `DELIVERY_UNCERTAIN` even though it was never sent.

### Correction

- Detach excluded retry item IDs in a dedicated DB transaction before the provider call.
- Treat an incomplete detach (`affected` count mismatch) as failure and do not call the provider.
- Scope direct unknown-outcome updates to the included mail-item IDs as defense in depth.
- Keep excluded items `PENDING`, clear only their delivery link, and retain every history row for later reclassification.
- Preserve the existing post-provider-ack lease recovery: if success persistence fails, only items still linked because they were in the payload can become uncertain.

### TDD evidence

RED:

```text
npm test -- --runInBand tenders/services/tender-mail.service.spec.ts
FAIL: 3 failed, 33 passed
- mixed retry + unknown outcome changed the excluded item to DELIVERY_UNCERTAIN
- post-ack persistence failure recovery changed the excluded item to DELIVERY_UNCERTAIN
- detach failure still called the provider
```

GREEN:

```text
npm test -- --runInBand tenders/services/tender-mail.service.spec.ts
PASS: 36 passed
```

## Finding 2: G2B license-limit partial failure

### Root cause

The three notice operations and license-limit enrichment shared one `Promise.all` rejection boundary. In addition, an empty `licenseLimits` array could not distinguish verified “no restriction” from unavailable enrichment, so G2B goods could be classified as eligible without complete evidence.

### Correction

- Return a typed per-source fetch result with `SUCCEEDED | PARTIAL` and a stable `errorCode`.
- Fetch notice collections independently from the caught license-enrichment result.
- On license-only failure, retain all normalized notices, set `licenseLimitsVerified=false`, and return `PARTIAL` with `LICENSE_LIMIT_UNAVAILABLE`.
- Mark successful G2B enrichment as verified; set K-apt and KEPCO deliberately to verified because they do not require the separate G2B enrichment operation.
- Exclude unverified goods as `EXCLUDED_NON_SUPPLY` with reason `면허제한 정보 확인 불가` before MAS or supply classification.
- Continue persisting relevant construction, goods, and service notices with their official `procurementType`; keep construction/service ineligible under the existing opportunity policy.
- Record a `PARTIAL` sync run and expose only the stable code in manual collection responses. `failedSources` still contains only `FAILED` sources.
- Keep collection watermark lookup limited to the last `SUCCEEDED` run so a later healthy run re-fetches and reclassifies notices from the degraded interval.
- Extend the frontend response union and show an alert even when no source fully failed.

### TDD evidence

Backend RED:

```text
npm test -- --runInBand tenders/adapters/tender-adapters.spec.ts tenders/domain/tender-opportunity-classifier.spec.ts tenders/services/tender-ingestion.service.spec.ts
FAIL: 3 failed, 46 passed
- adapter rejected the whole source on license failure
- unverified goods were classified GOODS_SUPPLY
- ingestion reported G2B as fully failed and persisted no partial result
```

Frontend RED:

```text
npm test -- src/components/admin/TenderManagement.spec.ts
FAIL: 1 failed, 17 passed
- PARTIAL with failedSources=[] displayed the normal success message
```

GREEN:

```text
npm test -- --runInBand tenders/adapters/tender-adapters.spec.ts tenders/domain/tender-opportunity-classifier.spec.ts tenders/services/tender-ingestion.service.spec.ts
PASS: 49 passed

npm test -- src/components/admin/TenderManagement.spec.ts
PASS: 18 passed

npm test -- --runInBand tenders/tenders.controller.spec.ts tenders/adapters/tender-adapters.spec.ts tenders/domain/tender-opportunity-classifier.spec.ts tenders/services/tender-ingestion.service.spec.ts
PASS: 58 passed
```

The adapter regression also verifies that neither the thrown provider detail nor `serviceKey` appears in the returned result. Controller and HTTP contract fixtures expose only `PARTIAL` and `LICENSE_LIMIT_UNAVAILABLE`, with no provider message, URL, or key.

## Finding 3: detail contract mismatch

### Root cause

Calendar and list queries applied `applyOpportunityEligibility`, but `getTender` filtered only by ID. The backend could therefore return excluded opportunity enums that are intentionally absent from the frontend public union.

### Correction

- Apply the shared `GOODS_SUPPLY | MAS` predicate to detail lookup before `getOne()`.
- Preserve the controller's existing not-found behavior when the query returns no eligible row.
- Keep the frontend `TenderOpportunityType` union unchanged as `GOODS_SUPPLY | MAS`.

### TDD evidence

RED:

```text
npm test -- --runInBand tenders/services/tender-query.service.spec.ts tenders/domain/tender-opportunity-classifier.spec.ts
FAIL: 1 failed, 15 passed
- detail lookup never called the eligible-opportunity predicate
```

GREEN:

```text
npm test -- --runInBand tenders/services/tender-query.service.spec.ts tenders/domain/tender-opportunity-classifier.spec.ts
PASS: 16 passed

npx jest --config ./test/jest-contract.json --runInBand test/tenders.contract-spec.ts
PASS: 9 passed, including excluded detail -> HTTP 404
```

## Finding 4: permitted-industries test gap

- Added a regression where `license.name` is `참가자격 제한` and `permittedIndustries` contains `전기공사업(0037)`.
- The test passed against the existing implementation during the detail RED run, confirming the production logic already inspected both fields.
- No production classifier change was made for this finding.

## Files changed

### Backend production

- `dfkorea-backend/src/tenders/services/tender-mail.service.ts`
- `dfkorea-backend/src/tenders/adapters/g2b-tender.adapter.ts`
- `dfkorea-backend/src/tenders/adapters/kapt-tender.adapter.ts`
- `dfkorea-backend/src/tenders/adapters/kepco-tender.adapter.ts`
- `dfkorea-backend/src/tenders/domain/normalized-tender.ts`
- `dfkorea-backend/src/tenders/domain/tender-source.adapter.ts`
- `dfkorea-backend/src/tenders/domain/tender-opportunity-classifier.ts`
- `dfkorea-backend/src/tenders/domain/tender.enums.ts`
- `dfkorea-backend/src/tenders/services/tender-ingestion.service.ts`
- `dfkorea-backend/src/tenders/services/tender-query.service.ts`

### Backend tests/contracts

- `dfkorea-backend/src/tenders/services/tender-mail.service.spec.ts`
- `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`
- `dfkorea-backend/src/tenders/domain/tender-opportunity-classifier.spec.ts`
- `dfkorea-backend/src/tenders/services/tender-ingestion.service.spec.ts`
- `dfkorea-backend/src/tenders/services/tender-query.service.spec.ts`
- `dfkorea-backend/src/tenders/tenders.controller.spec.ts`
- `dfkorea-backend/test/tenders.contract-spec.ts`
- `dfkorea-backend/test/tender-app-integration.spec.ts`

### Frontend

- `led-lighting-website/src/types/tender.ts`
- `led-lighting-website/src/components/admin/TenderManagement.vue`
- `led-lighting-website/src/components/admin/TenderManagement.spec.ts`

### Documentation

- `docs/menus/tenders.md`
- `database-schema.md`
- `.superpowers/sdd/2026-08-31-tender-supply-focus/final-review-fix-report.md`

## Full verification

```text
cd dfkorea-backend && npm run test:ci
PASS (exit 0)
- ESLint check passed
- unit: 31 suites, 265 tests passed
- tender contracts: 4 suites, 33 tests passed
- TypeScript noEmit passed
- Nest build passed
- compiled production-process probes passed
- compiled TypeORM discovery passed

cd led-lighting-website && npm test
PASS (exit 0): 14 files, 61 tests passed

cd led-lighting-website && npm run type-check
PASS (exit 0)

cd led-lighting-website && VITE_API_BASE_URL=https://api.example.com npm run build
PASS (exit 0)
- Nuxt emitted its existing module-preload sourcemap warning; the build completed successfully

git diff --check b14eb0e...HEAD
PASS (exit 0)
```

## Self-review

- Binding constraints: all five row classes are preserved; changes are updates/upserts only.
- Eligibility boundary: calendar, list, detail, initial mail, retry mail, and provider payloads share the eligible opportunity policy.
- Fail-closed boundary: unverified goods are excluded before electrical restriction, MAS, or supply branches can make them eligible.
- Degraded collection: license-only failure cannot reject successful notice operations; zero-notice and nonzero-notice partial results can still carry `PARTIAL` metadata.
- Recovery: excluded retry items are committed detached before the provider call; unknown and post-ack failure paths cannot contaminate them.
- Re-enrichment: a `PARTIAL` run is not a successful collection watermark, so a later complete run can revisit the degraded interval.
- Exposure: manual HTTP results contain the stable code only; provider errors, request URLs, and keys do not cross the ingestion summary boundary.
- Public detail contract: excluded rows remain stored but are inaccessible through the admin detail response, keeping the frontend union narrow.
- Documentation: tender menu behavior and the logical sync-run status values are current; no migration was added because physical schema did not change.
- Scope: no unrelated refactor or feature was added.

No blocking concern remains. Live approved-key G2B behavior is still an external deployment verification item already documented in `docs/menus/tenders.md`.

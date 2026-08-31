# Task 1 Report: Opportunity classifier and official adapter enrichment

## Implementation

- Added `TenderOpportunityType` with the required `GOODS_SUPPLY`, `MAS`, `EXCLUDED_CONSTRUCTION`, and `EXCLUDED_NON_SUPPLY` values.
- Added `TenderOpportunityClassifier`, applying the required priority: construction; goods with an electrical-construction license restriction; MAS goods; other goods; then service/other.
- MAS detection covers `다수\s*공급자\s*계약` and an independent ASCII `MAS` token across title, description, attachment names, and contract method.
- Added `NormalizedTender.licenseLimits` and a provider-neutral `TenderLicenseLimit` shape.
- G2B now fetches `getBidPblancListInfoLicenseLimit` once per collection window with the same official minute-window query, trims provider license fields, groups them by `bidNtceNo:bidNtceOrd`, and attaches only the matching rows to each normalized notice. License-limit request data is not added to `rawData`.
- K-apt now maps `codeClassifyType2` exactly as `02=CONSTRUCTION`, `03=SERVICE`, `04=GOODS`, unknown=`OTHER`.
- K-apt and KEPCO normalize `licenseLimits` as an empty array. Existing normalized-tender fixtures were updated to satisfy the now-required field.

## Files

- Added `dfkorea-backend/src/tenders/domain/tender-opportunity-classifier.ts`
- Added `dfkorea-backend/src/tenders/domain/tender-opportunity-classifier.spec.ts`
- Updated tender enums, normalized tender shape, all three adapters, official adapter fixtures/tests, and dependent normalized-tender fixtures in unit/integration contract tests.

## RED / GREEN evidence

### Classifier

- RED command: `cd dfkorea-backend && npm test -- --runInBand src/tenders/domain/tender-opportunity-classifier.spec.ts`
- RED result: failed with `TS2305` because `TenderOpportunityType` was not exported and `TS2307` because `tender-opportunity-classifier` did not exist.
- GREEN command: `cd dfkorea-backend && npm test -- --runInBand src/tenders/domain/tender-opportunity-classifier.spec.ts`
- GREEN result: `1 passed`, `5 passed` tests.

### Adapters

- RED command: `cd dfkorea-backend && npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts`
- RED result: failed with `TS2339` because `NormalizedTender.licenseLimits` did not exist. The new adapter expectations also cover the fourth G2B operation and official K-apt category mapping.
- GREEN command: `cd dfkorea-backend && npm test -- --runInBand src/tenders/domain/tender-opportunity-classifier.spec.ts src/tenders/adapters/tender-adapters.spec.ts`
- GREEN result: `2 passed`, `30 passed` tests.

## Verification commands and results

- `cd dfkorea-backend && npm run lint:check` — passed.
- `cd dfkorea-backend && npx tsc --noEmit` — passed.
- `cd dfkorea-backend && npm test -- --runInBand` — passed: `30` suites and `247` tests.
- `git diff --check` — passed with no whitespace errors.

## Self-review

- Confirmed construction is evaluated before all other signals, so a construction notice cannot be promoted to MAS or goods supply.
- Confirmed goods titles containing `공사` remain goods unless the official procurement type or a `전기공사업` license restriction excludes them.
- Confirmed license matching includes both `name` and `permittedIndustries`, and G2B keying includes revision to avoid cross-revision enrichment.
- Confirmed G2B request query has the required `inqryDiv=1`, `type=json`, and KST minute-window fields; request URLs/service keys are not copied into `rawData`.
- Confirmed only required-field fixture updates were made outside the listed Task 1 files, to keep TypeScript integration/contract fixtures compatible.

## Concerns

None.

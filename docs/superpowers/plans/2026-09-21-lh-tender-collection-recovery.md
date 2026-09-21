# LH Tender Collection Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify the evidence-backed cause preventing LH tender collection and apply the smallest secure, regression-tested recovery without changing opt-in deployment behavior.

**Architecture:** The collection path is traced backwards from the administrator query through sync persistence, adapter registration, candidate/classifier filtering, HTML parsing, and the HTTPS client. The implementation task is deliberately gated on that trace: it adds one consumer-observable regression test for the demonstrated root cause and changes only the owning boundary. Runtime configuration and external network state are diagnosed without exposing secrets.

**Tech Stack:** NestJS, TypeScript, Jest, Cheerio/HTML parsing, Docker Compose, React/Vite/Vitest (only if the diagnosis requires a UI change).

**Spec:** `docs/superpowers/specs/2026-09-08-lh-tender-collector-design.md`; supporting plan: `docs/superpowers/plans/2026-09-08-lh-tender-collector.md`.

## Global Constraints

- Retain `LH_TENDER_ENABLED=false` as the default; a disabled or missing operational flag is diagnosed and documented, never bypassed in code.
- Retain TLS certificate validation, HTTPS-only `ebid.lh.or.kr` host/path allowlists, redirect-hop validation, timeouts, response-size/request-count limits, sequential execution, and the 1500 ms minimum request interval.
- Do not weaken SSRF, attachment validation, ZIP safety, HTML structure validation, or sanitized-error boundaries.
- Do not log or persist provider HTML, request URLs/query strings, credentials, API keys, or personal data; diagnostics may contain only safe operation/status/attempt counts and configuration presence booleans.
- Never perform destructive production DB actions. A schema change requires a migration, rollback, and `database-schema.md` update; it is out of scope unless the trace proves it necessary.
- Make no real-site request unless local evidence leaves it necessary; if needed, make one low-load HTTPS smoke request and stop on CAPTCHA, login, certificate mismatch, or structure change.
- Update `docs/menus/tenders.md` with verified behavior, limits, monitoring, rollback, and explicit operating steps. Preserve its required sections.
- Leave unrelated user changes untouched; do not create a PR or merge to `main`.

## Review Focus

- Disabled/missing `LH_TENDER_ENABLED`: execution must remain opt-in and surface a sanitized, actionable status rather than silently scraping.
- Redirect to a non-LH, non-HTTPS, or disallowed path: every hop must be rejected before a request can escape the boundary.
- HTML structure/date/pagination changes: the collector must stop with a safe, sanitized failure instead of treating malformed provider content as an empty collection.
- Candidate and classifier exclusions: a valid LED tender must still reach persistence, while non-LED tender data remains excluded.
- Deployment certificate propagation: Docker build/runtime must contain only the pinned CA and compile/run with `NODE_EXTRA_CA_CERTS`, without disabling TLS validation.

## File Map

- `dfkorea-backend/src/tenders/adapters/lh-tender.adapter.ts` — LH collection orchestration, bounded sequential listing/detail flow, and sanitized run outcomes.
- `dfkorea-backend/src/tenders/adapters/lh-html.ts` — allowed LH HTML request/parse boundary.
- `dfkorea-backend/src/tenders/public-api-client.ts` — constrained public HTTP client and redirect/TLS protections.
- `dfkorea-backend/src/tenders/tenders.module.ts` — adapter registration and runtime configuration wiring.
- `dfkorea-backend/src/**/__tests__/*lh*` or the existing colocated LH tests — regression fixture/test at the root-cause boundary.
- `dfkorea-backend/Dockerfile`, Docker Compose/environment assets, and `certificates/` — examined only to verify deployment certificate propagation; changed only if the evidence proves packaging is the cause.
- `docs/menus/tenders.md` — administrator tender collection behavior and operational guidance.

### Task 1: Establish a safe evidence baseline and trace the failing boundary

**Files:**
- Read: `docs/superpowers/specs/2026-09-08-lh-tender-collector-design.md`
- Read: `docs/superpowers/plans/2026-09-08-lh-tender-collector.md`
- Read: LH adapter/client/parser/module, their tests, Docker assets, sync services, administrator query path, and analogous G2B/KAPT/KEPCO implementations.
- Modify: this plan only, to record verified root-cause evidence and completed checkboxes.

**Interfaces:**
- Consumes: deployed configuration contract, existing LH fixture/test contract, and admin/scheduler collection entry points.
- Produces: a single root-cause hypothesis with reproducible evidence and the exact owning test/implementation boundary for Task 2.

- [x] Run the current focused LH tests and record their command, result, and errors without changing production code.
- [x] Run the current backend test command if feasible and record the baseline separately from any later regression result.
- [x] Inspect `978abf4` and the three newer LH commits, then trace the collection data flow backwards from administrator results to runtime configuration and outbound request construction.
- [x] Record evidence for each bounded failure category: feature flag, Docker certificate propagation, TLS/redirect/HTTP status, query/form/date/pagination, listing/detail parser structure, candidate filter, classifier, module registration, persistence, and administrator query filtering.
- [x] Compare LH with analogous G2B/KAPT/KEPCO boundaries and record meaningful differences only.
- [x] State exactly one evidence-backed root-cause hypothesis. If the only demonstrated blocker is inaccessible runtime configuration, document it as an operations diagnosis and do not invent a code fix.

### Task 2: Add a regression test and make the smallest source-boundary correction

**Files:**
- Modify: `dfkorea-backend/src/tenders/domain/tender.enums.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/lh-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/lh-tender.adapter.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-ingestion.service.ts`
- Modify: `led-lighting-website/src/types/tender.ts`
- Modify: `led-lighting-website/src/components/admin/TenderManagement.vue`
- Modify: `led-lighting-website/src/components/admin/TenderManagement.spec.ts`

**Interfaces:**
- Consumes: Task 1’s reproduced failure and named root-cause boundary.
- Produces: `SyncRunStatus.SKIPPED` with `FEATURE_DISABLED` for deliberately disabled LH collection, persisted as a non-watermark sync result and rendered as a safe operator action.

- [x] Write the backend test `reports explicitly disabled LH configuration without requesting the provider`, which expects no request, `SKIPPED`, and `FEATURE_DISABLED`; write the UI test `reports an LH disabled collection with the required opt-in action`, which expects an alert mentioning `LH_TENDER_ENABLED=true`.
- [x] Run the two focused tests and verify RED: the current adapter produces `SUCCEEDED` with no error code, and the current UI produces the generic successful-collection status.
- [x] Add the `SKIPPED` enum member, return it only from the disabled LH branch with safe code `FEATURE_DISABLED`, widen the collection summary type, and preserve `failedSources` as actual failures only. Add `SKIPPED` to the frontend wire type and prioritize a disabled-source alert over generic completion. Do not alter feature-flag parsing, request limits, TLS, or runtime configuration.
- [x] Re-run the two focused tests and verify GREEN; rerun affected adapter, ingestion, controller/contract, and frontend tests.
- [x] The first hypothesis was confirmed; no rollback or architectural escalation was required.

### Task 3: Verify delivery behavior, document operations, and commit

**Files:**
- Modify: `docs/menus/tenders.md`
- Modify: this plan, to mark actual outcomes, test evidence, and any uncompleted step with a concrete follow-up.
- Modify: `database-schema.md` only if Task 2 necessarily changes persisted schema.

**Interfaces:**
- Consumes: Task 2’s verified source behavior and deployment/runtime findings.
- Produces: deployment-safe operational instructions, final evidence, and a reviewable commit.

- [x] Run the impacted backend suites, the backend CI script, and the Docker build-context/certificate regression; record environment-specific non-LH CI outcomes below.
- [x] Run the affected Vitest suite, frontend type-check script, and production build script; record the safe example-API artifact-check limitation below.
- [x] Inspect `git diff` and `git status` for scope; update the tender menu document’s required sections with root cause, constraints, monitoring, safe rollback, and operator sequence.
- [x] Conduct an independent whole-branch review; route Critical/Important findings through a fresh RED→GREEN fix pass and ledger deferred minor findings.
- [x] Commit the bounded implementation and documentation with a conventional, focused message. Do not push, open a PR, or merge.
- [ ] Record the final commit SHA, red/green commands/results, full verification results, required environment/redeploy/one-shot collection/monitoring steps, and residual risks.

## Progress and Evidence

- [x] Saved the approved recovery plan before investigation.
- [x] Task 1 evidence baseline and root-cause hypothesis.
- [x] Task 2 regression RED→GREEN and minimal correction.
- [ ] Task 3 full verification, documentation, review, and commit.

### Root-cause record

**Hypothesis confirmed by repository-local execution:** an LH deployment with no externally injected `LH_TENDER_ENABLED=true` is fail-closed, but the collector reports that intentional non-execution as a successful zero-result run. In production, the app ignores the development environment file; the Docker runtime sets the supplemental CA path but does not set the LH feature flag. The module enables LH only when the supplied value is exactly `"true"`. The existing LH adapter test reproduced the resulting behavior: no outbound request, `SUCCEEDED`, no error code, and no notices. Because the administrator UI treats every `SUCCEEDED` source as a completed collection, an operator receives a misleading completion message rather than a safe instruction to enable the explicitly opt-in integration.

The minimum correction is therefore **observability, not forced enablement**: preserve the no-request behavior and default false flag, but persist/return a safe `SKIPPED` result with `FEATURE_DISABLED` and display an LH-specific operator action. No runtime secret or flag value was read.

Verified non-causes and bounded follow-ups:

- **Adapter registration and data path:** the LH adapter is included in `TENDER_SOURCE_ADAPTERS`; collection creates a sync run, classifies, upserts by source/notice/revision, and the query visibility condition restricts only non-goods G2B records. LH is not hidden after a successful save.
- **Parser, form dates, pagination, candidate filter, and classifier:** the focused 32-test suite passes. It exercises the two work types, collection-time deadline window, sequential pagination, valid lighting candidate, malformed structure, limits, and display exclusion. It proves fixture compatibility but not the live provider’s future HTML.
- **Docker certificate packaging:** the PEM parses as a CA with subject `TuringSign RSA Secure CA 2`, issuer `OISTE WISeKey Global Root GB CA`, valid through 2030-05-26, and SHA-256 fingerprint `A6:F9:C9:67:EB:8A:A9:28:3A:1C:A6:49:B8:7B:76:47:20:E9:F5:C3:AF:A8:1C:15:06:76:F4:CA:36:E9:8C:F6`. The Dockerfile copies that one file and configures `NODE_EXTRA_CA_CERTS`; its packaging test rejects disabled TLS verification.
- **Live LH TLS/HTTP/redirect/HTML evidence:** unavailable from this runner. One bounded public smoke attempt failed first at sandbox DNS resolution and then at a 20-second outbound connection timeout before any HTTP or TLS result. No provider body was printed, persisted, or treated as a successful result. An operator must run the documented one-shot smoke from the deployed network.
- **Manual-request duration:** not treated as the root cause because the live candidate count is unavailable. It remains a deployment risk: the configured 50 pages for each work type plus 200 details can exceed the frontend relay’s 240-second request budget at a 1,500 ms request interval. The backend may need asynchronous execution if production metrics show this path is reached; this recovery does not weaken the bounds or increase concurrency.

### Comparison record

- G2B and K-apt are always attempted from their configured public API clients; KEPCO and LH are explicit opt-in sources. KEPCO has the same historical disabled-as-success shape, but the reported incident and the secure CA integration are LH-specific, so this minimal recovery does not broaden scope.
- LH alone uses the bounded HTML client with fixed host/scheme/path/redirect validation, body and timeout limits, form POST for lists, GET detail pages, and explicit inter-request delay. G2B/K-apt use structured public API clients; their broader retry/relay policies must not be copied into the LH boundary.
- LH’s title prefilter and shared classifier both retain direct lighting terms. The parser fixture demonstrates a candidate can reach persistence, and the query layer exposes LH records; neither is the demonstrated zero-result cause.

### Verification record

- Initial focused run before dependencies: unable to execute because this isolated worktree had no Jest installation. `npm ci` installed the lockfile dependencies; Node 24 emitted a non-blocking engine warning because the project requests Node 22.
- Baseline focused run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/adapters/lh-tender.adapter.spec.ts` — 1 suite, 32 tests passed.
- Baseline full CI in the sandbox first failed only because test HTTP servers cannot bind `0.0.0.0`; the same unmodified revision passed in the authorized local execution environment: 76/76 executed suites, 1,077 tests passed (2 suites/116 tests intentionally skipped), 4 tender contract suites/35 tests passed, TypeScript build and compiled production/TypeORM probes passed.
- Regression RED: the adapter test received `SUCCEEDED`/`null` instead of `SKIPPED`/`FEATURE_DISABLED`; the UI test received the generic success status and no alert. GREEN: backend adapter, ingestion, and controller suites passed 60 tests; the focused frontend tender management suite passed 27 tests.
- After the first GREEN pass, the production-environment probe exposed an omitted common contract: `TenderSourceFetchResult` did not admit `SKIPPED`. Adding that one union member restored the TypeScript production probe; the same 60 backend tests and `npx tsc --noEmit` passed again.
- Final backend CI evidence: the Node 22 Alpine Docker builder compiled successfully and the LH CA bundle test passed. The isolated full CI reached 75 passing suites / 1,076 passing tests before the pre-existing quote-mail test failed because this Alpine Node image formats a Korean default day period as `AM` rather than `오전`; it is unrelated to LH and reproduces with the unmodified quote-mail test. Local Node 24 full-CI attempts likewise reached the LH suites but stopped in unrelated HTTP authorization tests that varied between attempts, while the focused affected suites stayed green. No unrelated production code was changed to mask these runner-dependent failures.
- Final frontend evidence: `TenderManagement.spec.ts` passed 27 tests and `nuxt typecheck` passed. A production build with safe `https://api.example.test` completed Nuxt compilation plus the G2B relay and About metadata checks, then the existing search-index verifier rejected the example API's zero product-detail anchors. No production API value was read or written; this external-data check does not exercise the changed LH alert.
- Review-remediation RED→GREEN: the independent reviewer found that an LH `SKIPPED` result hid a simultaneous real failed source. The new mixed-result UI test first failed because the rendered alert omitted the failed-source warning; after combining the safe LH enablement instruction with the actual failure message, the TenderManagement suite passed 28 tests and `nuxt typecheck` passed. The safe example-API production build repeated the same non-LH product-anchor verifier limitation after Nuxt compilation and the two preceding artifact checks passed.

### Independent review record

- Read-only review of `978abf4..e35213d` found no Critical issue and one Important issue: `TenderManagement.vue` prioritized the LH disabled alert over `failedSources`, so a concurrent G2B/K-apt failure could be hidden. The follow-up test/fix above resolved it without changing backend request behavior or the security boundary.
- The reviewer confirmed that `SKIPPED` does not join `failedSources` and does not advance the `SUCCEEDED` watermark query; the existing `varchar` status column needs no migration. It also confirmed that TLS, SSRF/redirect allowlists, request bounds, sequential pacing, and the default opt-in configuration were untouched.
- Deferred minor findings: none. Live provider availability, deployed variable injection, and live TLS/redirect behavior remain explicitly outside this repository-local review and require the operator follow-up below.

### Operational follow-up record

1. Set the deployed runtime variable `LH_TENDER_ENABLED=true`; do not change the repository default and do not expose or copy unrelated secrets.
2. Rebuild and redeploy the image containing the verified supplemental CA; run one administrator immediate collection only after deployment is healthy.
3. Monitor the LH `tender_sync_runs` row and administrator result: `SKIPPED`/`FEATURE_DISABLED` means the opt-in value was not effective and no provider request was made. For `SUCCEEDED`/`PARTIAL`/`FAILED`, inspect only safe status/counts, request duration, bounded-page/detail indicators, and stored official-link/document state.
4. On structure change, certificate trouble, unexpected request growth, or an unsafe result, set the flag back to `false` and redeploy. Do not bypass TLS, relax allowlists/limits, or blindly repeat a timed-out manual request.
5. Residual risks: the runner could not reach the public LH endpoint (DNS/20-second timeout) and the maximum sequential request set can exceed the 240-second administrator relay budget. Validate one low-load collection from the deployed network; consider a separately designed asynchronous path only if observed metrics require it.

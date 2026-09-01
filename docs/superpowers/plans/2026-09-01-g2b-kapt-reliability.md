# G2B and K-apt Tender Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve broad G2B construction, goods, and service collection through transient provider failures and make every existing and future K-apt official-source link open the current valid detail page.

**Architecture:** `PublicApiClient` owns page-level pacing, retry classification, and safe provider diagnostics. `G2bTenderAdapter` runs the three broad operations sequentially and returns a provider-neutral result that can preserve successful notices as `PARTIAL`; `TenderIngestionService` persists that result without advancing the last-complete-success watermark. K-apt changes its canonical URL builder and ships a forward-only data migration for already stored links.

**Tech Stack:** NestJS 10, TypeScript, Jest, TypeORM/PostgreSQL, Nuxt 4, Vue 3, Vitest, Railway, Vercel

**Spec:** `docs/superpowers/specs/2026-09-01-g2b-resilient-collection-design.md`

## Global Constraints

- Continue collecting G2B construction, goods, and service notices; do not restore goods-supply or MAS eligibility filtering.
- G2B request starts must be at least 1,100ms apart and operations must run in construction → goods → service order.
- Retry only provider code `23`, HTTP `429/502/503/504`, request timeout, and network error; allow at most two retries with 1,000ms and 3,000ms delays.
- Never log or return API keys, full URLs, query strings, provider bodies, or raw exception causes.
- A partially successful G2B run persists successful notices as `PARTIAL`; only `SUCCEEDED` may become the next watermark.
- Do not change the tender relevance classifier, mail filters, collection schedule, or K-apt/KEPCO collection policy.
- Delete no database rows and no mail/history data. The K-apt migration changes only stale `sourceUrl` strings and has an intentional no-op `down`.
- Update `docs/menus/tenders.md`; document the data-only migration in `database-schema.md` without claiming a schema change.

---

### Task 1: Add page-level pacing, retries, and safe provider diagnostics

**Files:**
- Modify: `dfkorea-backend/src/tenders/adapters/public-api-client.ts`
- Test: `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`

**Interfaces:**
- Consumes: existing `PublicApiRequest` and `TenderSourceErrorCode`.
- Produces: `PublicApiRetryEvent`, expanded `TenderSourceError`, and `PublicApiClientOptions` with `minimumRequestIntervalMs`, `retryDelaysMs`, and optional `onRetry`.

- [x] **Step 1: Write failing retry, parsing, and pacing tests**

Add tests that exercise the real client with a controlled `fetcher`. The production change that makes them pass is page-level retry and shared request-slot scheduling.

```ts
const providerResponse = (
  resultCode: string,
  items: Record<string, unknown>[] = [],
  totalCount = items.length,
  status = 200,
) => new Response(JSON.stringify({
  response: { header: { resultCode }, body: { totalCount, items } },
}), { status });

const requestFor = (operation: string): PublicApiRequest => ({
  source: TenderSource.G2B,
  baseUrl: "https://api.example.test/bids",
  operation,
  query: { serviceKey: "secret-key" },
});

it("retries provider code 23 twice and retains safe page diagnostics", async () => {
  jest.useFakeTimers();
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(providerResponse("23"))
    .mockResolvedValueOnce(providerResponse("23"))
    .mockResolvedValueOnce(providerResponse("00", [], 0));
  const onRetry = jest.fn();
  const client = new PublicApiClient(fetcher, {
    retryDelaysMs: [1_000, 3_000],
    onRetry,
  });

  const result = client.getAllPages(requestFor("getBidPblancListInfoThng"));
  await jest.advanceTimersByTimeAsync(4_000);

  await expect(result).resolves.toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(onRetry).toHaveBeenNthCalledWith(1, expect.objectContaining({
    operation: "getBidPblancListInfoThng",
    pageNo: 1,
    providerResultCode: "23",
    attempt: 1,
  }));
  jest.useRealTimers();
});

it.each([
  ["provider", providerResponse("30")],
  ["http", new Response("", { status: 401 })],
])("does not retry permanent %s failures", async (_label, response) => {
  const fetcher = jest.fn().mockResolvedValue(response);
  const client = new PublicApiClient(fetcher, { retryDelaysMs: [1_000, 3_000] });
  await expect(client.getAllPages(requestFor("notices"))).rejects.toBeInstanceOf(TenderSourceError);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("paces concurrent callers through one shared request-start slot", async () => {
  jest.useFakeTimers();
  const starts: number[] = [];
  const fetcher = jest.fn(async () => {
    starts.push(Date.now());
    return providerResponse("00", [], 0);
  });
  const client = new PublicApiClient(fetcher, { minimumRequestIntervalMs: 1_100 });
  const requests = Promise.all([
    client.getAllPages(requestFor("construction")),
    client.getAllPages(requestFor("goods")),
  ]);
  await jest.runAllTimersAsync();
  await requests;
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1_100);
  jest.useRealTimers();
});
```

Also add exact cases for HTTP `429/502/503/504`, `REQUEST_TIMEOUT`, and `NETWORK_ERROR`, plus gateway envelopes under `OpenAPI_ServiceResponse.cmmMsgHeader.returnReasonCode`. Assert that error messages and retry events contain none of `serviceKey`, the request URL, provider message, or response body.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts
```

Expected: FAIL because retry options, gateway code parsing, request metadata, and shared pacing do not exist.

- [x] **Step 3: Implement the minimal client behavior**

Use these exact public shapes:

```ts
export interface PublicApiRetryEvent {
  source: TenderSource;
  operation: string;
  pageNo: number;
  errorCode: TenderSourceErrorCode;
  providerResultCode: string | null;
  httpStatus: number | null;
  attempt: number;
}

export interface PublicApiClientOptions {
  timeoutMs?: number;
  minimumRequestIntervalMs?: number;
  retryDelaysMs?: readonly number[];
  onRetry?: (event: PublicApiRetryEvent) => void;
}
```

Expand `TenderSourceError` with non-secret fields `operation`, `pageNo`, `providerResultCode`, and `attempts`. Implement `fetchPageWithRetry()` around `fetchPage()`. `isRetryable()` must return true only for the Global Constraints list. Reserve request slots synchronously through one `nextRequestAt` value before awaiting so concurrent callers cannot take the same slot. Parse both normal `response.header.resultCode` and `OpenAPI_ServiceResponse.cmmMsgHeader.returnReasonCode`.

Keep this constructor order consistent across client, adapter, and tests:

```ts
constructor(
  readonly source: TenderSource,
  readonly code: TenderSourceErrorCode,
  readonly status: number | null = null,
  cause?: unknown,
  readonly operation: string | null = null,
  readonly pageNo: number | null = null,
  readonly providerResultCode: string | null = null,
  readonly attempts = 1,
)
```

- [x] **Step 4: Run focused and existing cancellation tests and verify GREEN**

Run the same Jest command. Expected: all adapter/client tests PASS, including timeout and caller-abort cleanup tests with no open timers.

- [x] **Step 5: Commit Task 1**

```bash
git add dfkorea-backend/src/tenders/adapters/public-api-client.ts \
  dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts
git commit -m "fix: harden public tender API requests"
```

---

### Task 2: Preserve G2B operation-level partial successes

**Files:**
- Modify: `dfkorea-backend/src/tenders/domain/tender-source.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/domain/tender.enums.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/g2b-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/kapt-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/kepco-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-ingestion.service.ts`
- Test: `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`
- Test: `dfkorea-backend/src/tenders/services/tender-ingestion.service.spec.ts`
- Test: `dfkorea-backend/src/tenders/tenders.controller.spec.ts`
- Test: `dfkorea-backend/test/tenders.contract-spec.ts`

**Interfaces:**
- Consumes: Task 1 `TenderSourceError` metadata and `PublicApiClient` options.
- Produces: `TenderSourceFetchResult`, `TenderOperationFailure`, and `SyncRunStatus.PARTIAL` used by ingestion and the frontend contract.

- [x] **Step 1: Write failing adapter and ingestion tests**

Define tests before changing the interface:

```ts
const constructionRow = {
  ...g2bFixture.response.body.items[0],
  bidNtceNo: "CONSTRUCTION-1",
};
const serviceRow = {
  ...g2bFixture.response.body.items[0],
  bidNtceNo: "SERVICE-1",
};
const adapterWith = (client: jest.Mocked<TenderApiClient>) =>
  new G2bTenderAdapter(client, {
    baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
    serviceKey: "test-key",
  });

it("runs broad G2B operations sequentially and keeps successful notices when one operation fails", async () => {
  const client = createClient();
  client.getAllPages
    .mockResolvedValueOnce([constructionRow])
    .mockRejectedValueOnce(new TenderSourceError(
      TenderSource.G2B,
      "PROVIDER_RESULT_ERROR",
      200,
      undefined,
      "getBidPblancListInfoThng",
      1,
      "23",
      3,
    ))
    .mockResolvedValueOnce([serviceRow]);

  const result = await adapterWith(client).fetchNotices(window);

  expect(client.getAllPages.mock.calls.map(([request]) => request.operation)).toEqual([
    "getBidPblancListInfoCnstwk",
    "getBidPblancListInfoThng",
    "getBidPblancListInfoServc",
  ]);
  expect(result.status).toBe(SyncRunStatus.PARTIAL);
  expect(result.notices.map((notice) => notice.procurementType)).toEqual([
    ProcurementType.CONSTRUCTION,
    ProcurementType.SERVICE,
  ]);
  expect(result.failures).toEqual([
    expect.objectContaining({
      operation: "getBidPblancListInfoThng",
      pageNo: 1,
      providerResultCode: "23",
    }),
  ]);
});

it("persists partial notices without treating the run as a successful watermark", async () => {
  const safeFailure: TenderOperationFailure = {
    operation: "getBidPblancListInfoThng",
    errorCode: "PROVIDER_RESULT_ERROR",
    pageNo: 1,
    providerResultCode: "23",
    httpStatus: 200,
    attempts: 3,
  };
  g2b.fetchNotices.mockResolvedValue({
    notices: [directNotice],
    status: SyncRunStatus.PARTIAL,
    errorCode: "PARTIAL_PROVIDER_FAILURE",
    failures: [safeFailure],
  });

  const summary = await service.collectAll(NOW);

  expect(tenderRepository.upsert).toHaveBeenCalled();
  expect(summary.sources).toContainEqual(expect.objectContaining({
    source: TenderSource.G2B,
    status: SyncRunStatus.PARTIAL,
    fetchedCount: 1,
    errorCode: "PARTIAL_PROVIDER_FAILURE",
  }));
  expect(summary.failedSources).toEqual([]);
});
```

Add a separate all-three-fail test expecting `FAILED`, zero notices, and no upsert. Spy on `Logger.prototype.warn` and assert safe operation/page/code/status/attempt fields are present while secret strings and raw response text are absent. Keep the existing `resolveWindow` assertion that queries only `status: SUCCEEDED`.

- [x] **Step 2: Run adapter, ingestion, and contract tests and verify RED**

```bash
cd dfkorea-backend
npm test -- --runInBand \
  src/tenders/adapters/tender-adapters.spec.ts \
  src/tenders/services/tender-ingestion.service.spec.ts \
  src/tenders/tenders.controller.spec.ts
npm run test:tender:contract
```

Expected: FAIL because adapters still return arrays and `PARTIAL` is not a valid status.

- [x] **Step 3: Add the provider-neutral result contract**

Use these exact types in `tender-source.adapter.ts`:

```ts
export interface TenderOperationFailure {
  operation: string;
  errorCode: string;
  pageNo: number | null;
  providerResultCode: string | null;
  httpStatus: number | null;
  attempts: number;
}

export interface TenderSourceFetchResult {
  notices: NormalizedTender[];
  status: SyncRunStatus.SUCCEEDED | SyncRunStatus.PARTIAL | SyncRunStatus.FAILED;
  errorCode: string | null;
  failures: TenderOperationFailure[];
}

export interface TenderSourceAdapter {
  readonly source: TenderSource;
  fetchNotices(window: TenderFetchWindow): Promise<TenderSourceFetchResult>;
}
```

Add `PARTIAL = "PARTIAL"` to `SyncRunStatus`. Wrap K-apt and enabled/disabled KEPCO array results as `SUCCEEDED` with `failures: []`; do not change their request policies.

- [x] **Step 4: Implement sequential G2B results and safe ingestion logging**

Replace `Promise.all` in `G2bTenderAdapter` with a `for...of` loop. Catch each operation, convert `TenderSourceError` through one private `toOperationFailure(operation, error)` helper, and continue. Track `successfulOperationCount` independently from the notice count so a valid empty provider response still counts as a successful operation. Calculate the result exactly:

```ts
const status = failures.length === 0
  ? SyncRunStatus.SUCCEEDED
  : successfulOperationCount > 0
    ? SyncRunStatus.PARTIAL
    : SyncRunStatus.FAILED;
return {
  notices,
  status,
  errorCode: status === SyncRunStatus.PARTIAL
    ? "PARTIAL_PROVIDER_FAILURE"
    : status === SyncRunStatus.FAILED
      ? failures[0]?.errorCode ?? "COLLECTION_ERROR"
      : null,
  failures,
};
```

Configure only the G2B client in `tenders.module.ts` with `minimumRequestIntervalMs: 1_100`, `retryDelaysMs: [1_000, 3_000]`, and a safe retry logger. Import `Logger` from `@nestjs/common` and construct the callback without serializing the event object:

```ts
const logger = new Logger("G2bPublicApiClient");
const client = new PublicApiClient(undefined, {
  minimumRequestIntervalMs: 1_100,
  retryDelaysMs: [1_000, 3_000],
  onRetry: (event) => logger.warn(
    `source=${event.source}; errorCode=${event.errorCode}; operation=${event.operation}; page=${event.pageNo}; providerCode=${event.providerResultCode ?? "none"}; httpStatus=${event.httpStatus ?? "none"}; attempt=${event.attempt}`,
  ),
});
```

In `TenderIngestionService`, classify and upsert `fetchResult.notices`, persist `fetchResult.status/errorCode`, and log each final failure through a formatter that accepts only the `TenderOperationFailure` fields. Expand `SourceCollectionSummary.status` to include `SyncRunStatus.PARTIAL`. `failedSources` continues to contain only `FAILED` sources, so the existing API field retains its meaning.

- [x] **Step 5: Run focused and contract tests and verify GREEN**

Run the Step 2 commands. Expected: all selected suites and all contract suites PASS.

- [x] **Step 6: Commit Task 2**

```bash
git add dfkorea-backend/src/tenders
git add dfkorea-backend/test/tenders.contract-spec.ts
git commit -m "fix: preserve partial G2B collection results"
```

---

### Task 3: Show partial collection accurately in the admin UI

**Files:**
- Modify: `led-lighting-website/src/types/tender.ts`
- Modify: `led-lighting-website/src/components/admin/TenderManagement.vue`
- Test: `led-lighting-website/src/components/admin/TenderManagement.spec.ts`

**Interfaces:**
- Consumes: Task 2 `sources[].status = "PARTIAL"` collect response.
- Produces: user-visible partial G2B warning while retaining calendar/list refresh.

- [x] **Step 1: Write the failing component test**

```ts
it("reports a partial source and refreshes successful notices", async () => {
  api.collect.mockResolvedValueOnce({
    data: {
      lockAcquired: true,
      collectedAt: "2026-09-01T01:53:57.683Z",
      sources: [{
        source: "G2B",
        status: "PARTIAL",
        fetchedCount: 120,
        createdCount: 4,
        updatedCount: 3,
        excludedCount: 113,
        errorCode: "PARTIAL_PROVIDER_FAILURE",
      }],
      failedSources: [],
    },
  });
  const wrapper = mountTenderManagement();
  await flushPromises();

  await wrapper.get('[data-test="collect-tenders"]').trigger("click");
  await flushPromises();

  expect(wrapper.get('[role="alert"]').text()).toContain(
    "나라장터 일부 유형 수집에 실패했습니다. 다음 수집에서 다시 시도합니다.",
  );
  expect(api.getCalendar).toHaveBeenCalledTimes(2);
  expect(api.getAll).toHaveBeenCalledTimes(2);
});
```

- [x] **Step 2: Run the component test and verify RED**

```bash
cd led-lighting-website
npm test -- --run src/components/admin/TenderManagement.spec.ts
```

Expected: FAIL because `PARTIAL` is not typed or rendered as an alert.

- [x] **Step 3: Implement the minimal UI contract**

Change `TenderCollectionSourceStatus` to:

```ts
export type TenderCollectionSourceStatus = "SUCCEEDED" | "PARTIAL" | "FAILED";
```

In `collectTenders`, compute `const partialSources = data.sources.filter(({ status }) => status === "PARTIAL")`. Give `failedSources` precedence, then show the exact Korean partial warning when `partialSources.length > 0`, otherwise show success. Preserve the existing refresh and lock-held branches.

- [x] **Step 4: Run the component suite and verify GREEN**

Run the Step 2 command. Expected: all `TenderManagement` tests PASS.

- [x] **Step 5: Commit Task 3**

```bash
git add led-lighting-website/src/types/tender.ts \
  led-lighting-website/src/components/admin/TenderManagement.vue \
  led-lighting-website/src/components/admin/TenderManagement.spec.ts
git commit -m "fix: report partial tender collection"
```

---

### Task 4: Repair future and historical K-apt detail links

**Files:**
- Create: `dfkorea-backend/src/migrations/1788135100000-FixKaptSourceUrls.ts`
- Create: `dfkorea-backend/src/migrations/kapt-source-url.migrations.spec.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/kapt-tender.adapter.ts`
- Test: `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`
- Modify: `database-schema.md`
- Modify: `docs/menus/tenders.md`

**Interfaces:**
- Consumes: K-apt `bidNum` mapped to `NormalizedTender.sourceNoticeId`.
- Produces: canonical `https://www.k-apt.go.kr/bid/bidDetail.do?bidNum={encodedBidNum}` for new rows and a data-only correction for old rows.

- [x] **Step 1: Change tests first and verify the old route fails expectations**

Update the existing K-apt adapter expectation to:

```ts
sourceUrl: "https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=202608260001",
```

Create the migration test:

```ts
describe("FixKaptSourceUrls1788135100000", () => {
  it("updates only stale KAPT detail prefixes without deleting rows", async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };
    await new FixKaptSourceUrls1788135100000().up(runner as never);
    const sql = runner.query.mock.calls.map(([value]) => compactSql(value)).join(" ");
    expect(sql).toContain(`"source" = 'KAPT'`);
    expect(sql).toContain("https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=");
    expect(sql).toContain("https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=");
    expect(sql).not.toMatch(/\b(DELETE|TRUNCATE|DROP)\b/i);
  });

  it("does not restore the invalid route on down", async () => {
    const runner = { query: jest.fn() };
    await new FixKaptSourceUrls1788135100000().down(runner as never);
    expect(runner.query).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run focused tests and verify RED**

```bash
cd dfkorea-backend
npm test -- --runInBand \
  src/tenders/adapters/tender-adapters.spec.ts \
  src/migrations/kapt-source-url.migrations.spec.ts
```

Expected: adapter expectation FAILS on `/web/bid/`; migration test cannot import the new class.

- [x] **Step 3: Implement canonical URL generation and the data migration**

Change the adapter route to `/bid/bidDetail.do`. Add `FixKaptSourceUrls1788135100000 implements MigrationInterface` with `name = "FixKaptSourceUrls1788135100000"`. `up` must return when `tenders` does not exist, then execute one parameterized update:

```ts
await queryRunner.query(
  `UPDATE "tenders"
   SET "sourceUrl" = REPLACE("sourceUrl", $1, $2)
   WHERE "source" = 'KAPT'
     AND "sourceUrl" LIKE $3`,
  [
    "https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=",
    "https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=",
    "https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=%",
  ],
);
```

`down` contains only a comment explaining that a valid canonical URL must not be reverted to a known 404 route. Do not update rows from other sources or already canonical K-apt URLs.

- [x] **Step 4: Update operating documentation**

In `docs/menus/tenders.md`, add the canonical K-apt official-link behavior under `구현 완료`, add the data migration to `관련 파일`, and record the live-link verification limitation under `부족하거나 개선이 필요한 기능`. In `database-schema.md`, add `1788135100000-FixKaptSourceUrls` to migration history as a data-only, row-preserving correction; do not change the `tenders` column table.

- [x] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: both adapter and migration suites PASS.

- [x] **Step 6: Commit Task 4**

```bash
git add dfkorea-backend/src/migrations/1788135100000-FixKaptSourceUrls.ts \
  dfkorea-backend/src/migrations/kapt-source-url.migrations.spec.ts \
  dfkorea-backend/src/tenders/adapters/kapt-tender.adapter.ts \
  dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts \
  database-schema.md docs/menus/tenders.md
git commit -m "fix: repair K-apt official tender links"
```

---

### Task 5: Verify, review, deploy, and run production-safe smoke checks

**Files:**
- Review only: all files changed in Tasks 1–4
- Update if verification finds an omission: `docs/menus/tenders.md`, `database-schema.md`

**Interfaces:**
- Consumes: completed Task 1–4 commits.
- Produces: verified `main`, successful Railway/Vercel deployments, and a production-health report without secret output.

- [x] **Step 1: Run full backend CI**

```bash
cd dfkorea-backend
npm run test:ci
```

Expected: lint check, all Jest suites, tender contracts, TypeScript, Nest build, compiled production-process probes, and compiled TypeORM discovery all exit 0. Confirm the new migration appears in compiled discovery.

- [x] **Step 2: Run full frontend tests and production build**

```bash
cd led-lighting-website
npm test -- --run
VITE_API_BASE_URL=https://dfkorea-production.up.railway.app npm run build
```

Expected: all Vitest suites PASS and Nuxt production build exits 0. Existing chunk-size warnings are non-blocking; any test, type, or build error is blocking.

- [x] **Step 3: Perform the required code review gates**

Use `superpowers:requesting-code-review`. Review exact spec coverage, error redaction, retry bounds, timer cleanup, partial watermark behavior, and migration row-safety. Resolve every blocking finding and rerun the affected focused test before continuing.

- [x] **Step 4: Run final repository checks and push main**

```bash
git diff --check
git status --short --branch
git log --oneline -8
git push origin main
```

Expected before push: no unstaged or uncommitted files and `main` contains the Task 1–4 commits after the approved design/plan commits.

- [x] **Step 5: Confirm deployments and health**

Poll commit statuses until Railway and Vercel both report `success`. Then run:

```bash
curl -sS -o /tmp/dfkorea-health -w '%{http_code}\n' \
  https://dfkorea-production.up.railway.app/
```

Expected: `200`. Inspect Railway deployment logs for migration success and application startup without printing environment variables.

- [x] **Step 6: Run production-safe provider and link smoke checks**

Using Railway-provided environment variables without echoing them, call one recent G2B window through the actual adapter and report only status, counts, operation failures, and elapsed time. Use one real K-apt `bidNum` to confirm the old route returns 404 and the canonical route returns 200. Do not call the authenticated collect endpoint without an admin session and do not print API keys or full provider response bodies.

- [x] **Step 7: Hand off the authenticated final check**

Ask the user to refresh the admin page, press `즉시 수집`, and verify:

```json
{
  "source": "G2B",
  "status": "SUCCEEDED",
  "errorCode": null
}
```

If a provider operation still exhausts retries, expected behavior is `PARTIAL` with nonzero successful counts, saved notices visible in the calendar/list, and a safe Railway log identifying operation, page, provider code, HTTP status, and attempt.

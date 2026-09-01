# G2B Vercel Relay Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore reliable G2B construction, goods, and service collection from Railway by retaining direct collection and adding a secured Vercel fallback for the specific HTTP-200/missing-result-code failure.

**Architecture:** `PublicApiClient` remains the only provider pagination and result parser. `G2bTenderAdapter` calls it directly first and retries only eligible failed operations through a second client backed by an HMAC-authenticated relay fetcher; a private Nuxt server route validates and reconstructs one whitelisted G2B page request with Vercel-only credentials.

**Tech Stack:** NestJS 10, TypeScript 5, Jest 29, Nuxt 4/Nitro, Node.js crypto/fetch, Vitest 4, Railway, Vercel

**Spec:** `docs/superpowers/specs/2026-09-01-g2b-vercel-relay-design.md`

## Global Constraints

- Preserve direct G2B collection as the primary path and retain operation order: construction, goods, service.
- Relay fallback is allowed only for `PROVIDER_RESULT_ERROR` with HTTP status `200` and `providerResultCode === null`.
- A missing provider result code is accepted directly only for a canonical `response.body` with present `items`, finite non-negative `totalCount`, and no recognized error envelope.
- Never expose or log the public-data service key, relay shared secret, full provider/relay URL, query string, raw provider body, provider message, or raw cause.
- Relay operations are limited to `getBidPblancListInfoCnstwk`, `getBidPblancListInfoThng`, and `getBidPblancListInfoServc`.
- Relay query requires `type=json`, `inqryDiv=1`, 12-digit start/end dates, `pageNo` from 1 through 100, and `numOfRows=100`; unknown or duplicate input fields are rejected.
- HMAC is lowercase hexadecimal SHA-256 of `<timestamp>.<exact body>`, timestamp is Unix milliseconds within plus/minus five minutes, and comparison is timing-safe.
- Relay request starts remain sequential with a minimum 1,500 ms interval; direct requests retain 1,100 ms pacing and retry delays of 1,000 ms and 3,000 ms.
- Preserve per-operation partial success, deduplication, classification, and the `SUCCEEDED`-only watermark.
- Do not change KAPT, KEPCO, mail, calendar, collection schedule, database schema, or goods/MAS filtering.
- Update `docs/menus/tenders.md`; no `database-schema.md` change is required.

---

### Task 1: Strict Provider Response Validation and Safe Diagnostics

**Files:**
- Modify: `dfkorea-backend/src/tenders/adapters/public-api-client.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`

**Interfaces:**
- Consumes: existing `PublicApiClient.getAllPages<T>(request: PublicApiRequest): Promise<T[]>`
- Produces: exported `TenderResponseShape` union and `TenderSourceError.responseShape: TenderResponseShape | null`
- Produces: fail-closed parsing for unknown missing-code responses and accepted parsing for canonical missing-code responses

- [x] **Step 1: Write failing parser and redaction tests**

Add focused Jest cases under `describe("PublicApiClient")` proving these exact shapes:

```ts
const canonicalWithoutHeader = {
  response: {
    body: { items: [{ bidNtceNo: "1" }], totalCount: 1 },
  },
};
const gatewayError = {
  OpenAPI_ServiceResponse: {
    cmmMsgHeader: { errMsg: "SERVICE KEY IS NOT REGISTERED ERROR" },
  },
};

await expect(canonicalClient.getAllPages(request)).resolves.toEqual([
  { bidNtceNo: "1" },
]);
await expect(gatewayClient.getAllPages(request)).rejects.toMatchObject({
  code: "PROVIDER_RESULT_ERROR",
  status: 200,
  providerResultCode: null,
  responseShape: "GATEWAY_ERROR_SHAPE",
});
await expect(unknownClient.getAllPages(request)).rejects.toMatchObject({
  responseShape: "UNKNOWN_RESPONSE_SHAPE",
});
```

Also assert `JSON.stringify(error)` contains none of the gateway message, URL, query, service key, or raw cause.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts
```

Expected: FAIL because `responseShape` and canonical missing-header acceptance do not exist.

- [x] **Step 3: Add the response-shape contract**

Implement this exported union and append an optional constructor field without changing existing call-site semantics:

```ts
export type TenderResponseShape =
  | "CANONICAL_BODY_WITHOUT_CODE"
  | "GATEWAY_ERROR_SHAPE"
  | "UNKNOWN_RESPONSE_SHAPE";

export class TenderSourceError extends Error {
  constructor(
    readonly source: TenderSource,
    readonly code: TenderSourceErrorCode,
    readonly status: number | null = null,
    cause?: unknown,
    readonly operation: string | null = null,
    readonly pageNo: number | null = null,
    readonly providerResultCode: string | null = null,
    readonly attempts = 1,
    readonly responseShape: TenderResponseShape | null = null,
  ) { /* preserve non-enumerable cause behavior */ }
}
```

In `readPage`, identify canonical structure before permissive fallbacks. Treat a gateway object, `error`, or `errors` record as an error envelope. When no result code exists, accept only when `root.response` is a record, `response.body` is a record, the body owns both `items` and `totalCount`, `totalCount` is finite/non-negative, and no error envelope exists. Do not accept `body.data`, root-level bodies, or inferred counts in this branch.

- [x] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts
```

Expected: PASS, including existing retry, pagination, abort, timeout, and pacing cases.

- [x] **Step 5: Commit Task 1**

```bash
git add dfkorea-backend/src/tenders/adapters/public-api-client.ts dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts
git commit -m "fix: validate missing G2B result codes safely"
```

---

### Task 2: Secured Nuxt G2B Relay Route

**Files:**
- Create: `led-lighting-website/src/server/utils/g2b-relay.ts`
- Create: `led-lighting-website/src/server/utils/g2b-relay.spec.ts`
- Create: `led-lighting-website/src/server/api/internal/g2b-relay.post.ts`
- Create: `led-lighting-website/src/server/api/internal/g2b-relay.post.spec.ts`
- Modify: `led-lighting-website/nuxt.config.ts`
- Modify: `led-lighting-website/src/deployment-config.spec.ts`

**Interfaces:**
- Consumes: server-only runtime config `g2bRelaySharedSecret`, `g2bTenderApiBaseUrl`, and `publicDataServiceKey`
- Produces: `G2bRelayRequest`, `validateRelayPayload(value: unknown): G2bRelayRequest`, `verifyRelaySignature(input): boolean`, `buildG2bProviderUrl(input): URL`
- Produces: `POST /api/internal/g2b-relay` which performs exactly one provider-page fetch and returns provider JSON

- [x] **Step 1: Write failing pure utility tests**

Use the following public contract and deterministic fixture:

```ts
const body = JSON.stringify({
  operation: "getBidPblancListInfoThng",
  query: {
    type: "json",
    inqryDiv: "1",
    inqryBgnDt: "202608311500",
    inqryEndDt: "202609010633",
    pageNo: "1",
    numOfRows: "100",
  },
});
const timestamp = "1788222791000";

expect(verifyRelaySignature({ body, timestamp, signature, secret, nowMs: 1788222791000 })).toBe(true);
expect(() => validateRelayPayload({ ...JSON.parse(body), extra: true })).toThrow();
```

Cover all three allowed operations, unknown/duplicate query fields, invalid dates, reversed date window, invalid page range, non-100 row count, expired/future timestamps, malformed hex signatures, and URL construction where Vercel's key replaces all client-supplied key material.

- [x] **Step 2: Run utility tests and verify RED**

Run:

```bash
cd led-lighting-website
npm test -- src/server/utils/g2b-relay.spec.ts
```

Expected: FAIL because the utility module does not exist.

- [x] **Step 3: Implement the relay utility**

Define exact types and constants:

```ts
export const G2B_RELAY_OPERATIONS = [
  "getBidPblancListInfoCnstwk",
  "getBidPblancListInfoThng",
  "getBidPblancListInfoServc",
] as const;
export type G2bRelayOperation = (typeof G2B_RELAY_OPERATIONS)[number];
export interface G2bRelayRequest {
  operation: G2bRelayOperation;
  query: {
    type: "json";
    inqryDiv: "1";
    inqryBgnDt: string;
    inqryEndDt: string;
    pageNo: string;
    numOfRows: "100";
  };
}
```

Use `createHmac("sha256", secret)`, `timingSafeEqual`, strict own-key set equality, `/^\d{12}$/`, integer page validation, and `new URL(operation, normalizedBaseUrl)`. Set only the six allowed query fields plus Vercel's `serviceKey`.

- [x] **Step 4: Write failing route tests**

Test the event-handler boundary with mocked raw-body/header/runtime-config/fetch dependencies. Require generic 400 for invalid body, generic 401 for invalid/expired HMAC, generic 500 for missing server configuration, exactly one upstream fetch for valid input, response JSON forwarding, and generic status-only upstream failure without provider body leakage.

```ts
expect(fetchMock).toHaveBeenCalledTimes(1);
expect(String(fetchMock.mock.calls[0][0])).toContain("serviceKey=vercel-key");
expect(JSON.stringify(rejectedResponse)).not.toContain("vercel-key");
expect(JSON.stringify(rejectedResponse)).not.toContain("provider secret body");
```

- [x] **Step 5: Run route tests and verify RED**

Run:

```bash
cd led-lighting-website
npm test -- src/server/api/internal/g2b-relay.post.spec.ts
```

Expected: FAIL because the server route does not exist.

- [x] **Step 6: Implement the server route and private runtime configuration**

Read the exact raw request body with a hard 4 KiB limit before JSON parsing, authenticate `<timestamp>.<exact body>`, validate the payload, call upstream once with a bounded abort timeout, parse JSON, and return it. Convert errors to generic `createError({ statusCode, statusMessage })` values; never include provider content.

Add only private properties above `public` in `runtimeConfig`:

```ts
runtimeConfig: {
  g2bRelaySharedSecret: process.env.G2B_RELAY_SHARED_SECRET || "",
  g2bTenderApiBaseUrl: process.env.G2B_TENDER_API_BASE_URL || "",
  publicDataServiceKey: process.env.PUBLIC_DATA_SERVICE_KEY || "",
  public: { /* existing values unchanged */ },
},
```

Extend `deployment-config.spec.ts` to assert these names are outside `runtimeConfig.public` and that client bundles/config do not contain their environment values.

- [x] **Step 7: Run relay and deployment-config tests and verify GREEN**

Run:

```bash
cd led-lighting-website
npm test -- src/server/utils/g2b-relay.spec.ts src/server/api/internal/g2b-relay.post.spec.ts src/deployment-config.spec.ts
npm run type-check
```

Expected: all tests PASS and Nuxt type checking exits 0.

- [x] **Step 8: Commit Task 2**

```bash
git add led-lighting-website/src/server led-lighting-website/nuxt.config.ts led-lighting-website/src/deployment-config.spec.ts
git commit -m "feat: add secured G2B relay route"
```

---

### Task 3: Signed Backend Relay Fetcher and Per-Operation Fallback

**Files:**
- Create: `dfkorea-backend/src/tenders/adapters/g2b-relay.fetcher.ts`
- Create: `dfkorea-backend/src/tenders/adapters/g2b-relay.fetcher.spec.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/g2b-tender.adapter.ts`
- Modify: `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`

**Interfaces:**
- Consumes: the relay JSON/HMAC protocol produced by Task 2 and `TenderSourceError.responseShape` produced by Task 1
- Produces: `createG2bRelayFetcher(config: G2bRelayFetcherConfig, fetcher?: typeof fetch): typeof fetch`
- Produces: optional `relayClient?: TenderApiClient` and `relayEnabled?: boolean` in `G2bTenderAdapterConfig`
- Produces: operation-local fallback with unchanged `TenderSourceFetchResult` contract

- [x] **Step 1: Write failing relay fetcher tests**

Define this contract:

```ts
export interface G2bRelayFetcherConfig {
  relayUrl: string;
  sharedSecret: string;
  now?: () => number;
}

export function createG2bRelayFetcher(
  config: G2bRelayFetcherConfig,
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch;
```

Pass a provider URL containing `serviceKey=production-key` and assert the POST body contains only operation plus six whitelisted query fields, signature equals the deterministic HMAC, timestamp matches `now`, response is passed through, and malformed/provider-disallowed input throws a safe `TenderSourceError` without the key, secret, URL, query, body, or raw cause in enumerable/loggable output.

- [x] **Step 2: Run fetcher tests and verify RED**

Run:

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/adapters/g2b-relay.fetcher.spec.ts
```

Expected: FAIL because the relay fetcher does not exist.

- [x] **Step 3: Implement the signed relay fetcher**

Parse the input provider URL, require an exact allowed terminal operation, obtain each query value with `getAll(name).length === 1`, discard `serviceKey`, serialize the object once with `JSON.stringify`, sign `${timestamp}.${body}`, and POST with JSON/HMAC headers. Reject an empty/malformed relay URL or shared secret shorter than 32 characters as `CONFIGURATION_ERROR`. Do not log inputs or caught errors.

- [x] **Step 4: Write failing adapter fallback tests**

Add tests proving:

```ts
const directError = new TenderSourceError(
  TenderSource.G2B,
  "PROVIDER_RESULT_ERROR",
  200,
  undefined,
  "getBidPblancListInfoThng",
  1,
  null,
  1,
  "UNKNOWN_RESPONSE_SHAPE",
);
```

- only this eligible error reaches `relayClient`;
- a direct success is never repeated;
- HTTP errors, provider code `23`, non-200 errors, and relay-disabled configuration do not fall back;
- full relay recovery returns `SUCCEEDED` and all normalized notices;
- one unrecovered operation plus recovered/successful operations returns `PARTIAL` with only the remaining failure;
- relay failure metadata replaces the eligible direct failure without nested retries.

- [x] **Step 5: Run adapter tests and verify RED**

Run:

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts
```

Expected: FAIL because `G2bTenderAdapter` has no relay client or eligibility predicate.

- [x] **Step 6: Implement operation-local fallback**

Change the adapter configuration and constructor to accept:

```ts
export interface G2bTenderAdapterConfig {
  baseUrl: string;
  serviceKey: string;
  relayEnabled?: boolean;
}

constructor(
  private readonly client: TenderApiClient,
  private readonly config: G2bTenderAdapterConfig,
  private readonly relayClient?: TenderApiClient,
) {}
```

Extract one `fetchOperation(client, operation, window)` helper so direct and relay paths share exactly the same request construction. Catch a direct error and call relay only when enabled, configured, and the error matches the approved eligibility tuple. Normalize rows only after the final successful client result.

- [x] **Step 7: Wire relay configuration in `TendersModule`**

Construct the direct client exactly as today. When `G2B_RELAY_ENABLED === "true"`, construct a second `PublicApiClient(createG2bRelayFetcher(...), { minimumRequestIntervalMs: 1_500, retryDelaysMs: [1_000, 3_000], onRetry: safeLogger })` and pass it to the adapter. Read only:

```ts
G2B_RELAY_ENABLED
G2B_RELAY_URL
G2B_RELAY_SHARED_SECRET
```

Keep logging limited to source, safe error code, operation, page, provider code, HTTP status, attempt, and response-shape category.

- [x] **Step 8: Run backend focused tests and verify GREEN**

Run:

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/adapters/g2b-relay.fetcher.spec.ts src/tenders/adapters/tender-adapters.spec.ts
npx tsc --noEmit
```

Expected: all tests PASS and TypeScript exits 0.

- [x] **Step 9: Commit Task 3**

```bash
git add dfkorea-backend/src/tenders/adapters/g2b-relay.fetcher.ts dfkorea-backend/src/tenders/adapters/g2b-relay.fetcher.spec.ts dfkorea-backend/src/tenders/adapters/g2b-tender.adapter.ts dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts dfkorea-backend/src/tenders/tenders.module.ts
git commit -m "fix: recover G2B collection through relay"
```

---

### Task 4: Tender Operations Documentation and Full Verification

**Files:**
- Modify: `docs/menus/tenders.md`
- Modify: `docs/superpowers/plans/2026-09-01-g2b-vercel-relay.md` (checkboxes only)

**Interfaces:**
- Consumes: all code and deployment variables from Tasks 1 through 3
- Produces: an operator-readable tender menu status document and a fully verified branch

- [x] **Step 1: Update the tender menu status document**

Preserve the document's required headings (`구현 완료`, `미구현`, `부족하거나 개선이 필요한 기능`, `관련 파일`, `갱신 규칙`) and add:

```md
- G2B는 Railway 직접 수집을 우선하고, HTTP 200이지만 결과 코드가 없는 특정 실패만 Vercel 보안 릴레이로 작업 단위 재시도한다.
- 릴레이는 세 가지 G2B 작업과 고정 쿼리만 허용하며 HMAC 인증, 5분 시각 제한, 서버 전용 키를 사용한다.
- Railway 운영 변수: `G2B_RELAY_ENABLED`, `G2B_RELAY_URL`, `G2B_RELAY_SHARED_SECRET`.
- Vercel 운영 변수: `G2B_RELAY_SHARED_SECRET`, `G2B_TENDER_API_BASE_URL`, `PUBLIC_DATA_SERVICE_KEY`.
- 릴레이에서도 공공데이터포털 응답이 차단되면 별도 국내 호스팅 수집기가 필요하다.
```

- [x] **Step 2: Run backend CI verification**

Run:

```bash
cd dfkorea-backend
npm run test:ci
```

Expected: lint, unit tests, tender contract tests, type check, clean build, production-process probe, and TypeORM discovery all exit 0.

- [x] **Step 3: Run frontend CI-equivalent verification**

Run:

```bash
cd led-lighting-website
npm test
npm run type-check
NODE_ENV=production VITE_API_BASE_URL=https://dfkorea-production.up.railway.app npm run build
```

Expected: all Vitest tests pass, type check exits 0, and Nuxt production build completes.

- [x] **Step 4: Run secret and placeholder scans**

Run:

```bash
rg -n "production-key|provider secret body|G2B_RELAY_SHARED_SECRET.*(=|:) .+" dfkorea-backend led-lighting-website docs --glob '!*.spec.ts' --glob '!package-lock.json'
rg -n "TBD|TODO|implement later|fill in details" docs/superpowers/plans/2026-09-01-g2b-vercel-relay.md dfkorea-backend/src/tenders led-lighting-website/src/server
```

Expected: no real secret-like value and no implementation placeholder are found; fixture strings may appear only in tests.

- [x] **Step 5: Request final code review and resolve findings**

Provide the reviewer the approved spec, this plan, and the complete task commit range. Require explicit checks for fail-closed parsing, HMAC correctness, secret leakage, fallback eligibility, request pacing, and regression risk. Resolve every Critical/Important finding and rerun the affected focused suite.

- [x] **Step 6: Commit documentation**

```bash
git add docs/menus/tenders.md docs/superpowers/plans/2026-09-01-g2b-vercel-relay.md
git commit -m "docs: document G2B relay operations"
```

---

### Task 5: Secure Environment Setup, Deployment, and Production Proof

**Files:**
- No repository file changes expected.

**Interfaces:**
- Consumes: authenticated Railway project `dfkorea`, Vercel project `dfkorea-frontend`, production URLs, and the verified commits from Tasks 1 through 4
- Produces: deployed relay/backend fallback and an evidence-backed production G2B collection result

- [ ] **Step 1: Merge the verified worktree branch into local `main`**

Confirm `main` has no unrelated changes, merge with a non-fast-forward merge, and rerun `git status --short --branch`. Do not reset, discard, or overwrite user changes.

- [ ] **Step 2: Generate and set the shared secret without printing it**

Generate at least 32 random bytes in a temporary shell variable, feed the same value through authenticated Vercel and Railway CLI stdin/environment-variable commands, and unset the shell variable immediately. Never pass the value as an echoed command argument and never include CLI secret output in commentary.

- [ ] **Step 3: Copy server-only provider configuration to Vercel without displaying values**

Read `G2B_TENDER_API_BASE_URL` and `PUBLIC_DATA_SERVICE_KEY` from the linked Railway production environment directly into process variables, add them to Vercel production environment through stdin, then unset them. Set Railway:

```text
G2B_RELAY_ENABLED=true
G2B_RELAY_URL=https://dfkorealed.com/api/internal/g2b-relay
G2B_RELAY_SHARED_SECRET=<same hidden value>
```

- [ ] **Step 4: Push and wait for both deployments**

Push `main`, verify Vercel `dfkorea-frontend` reaches Ready and Railway `dfkorea` reaches Success, and require HTTP 200 from the existing public frontend/backend health paths before collection testing.

- [ ] **Step 5: Send a signed production relay probe**

Create a current, narrow query window known to have notices; locally generate the exact signed JSON request using the already configured secret without printing headers/body, call `https://dfkorealed.com/api/internal/g2b-relay`, and inspect only safe shape/count fields. Require a canonical provider success response; do not print the response body.

- [ ] **Step 6: Verify the authenticated production collection once**

Use the existing admin UI's `즉시 수집` action or an already-authorized session. Require:

```json
{
  "source": "G2B",
  "status": "SUCCEEDED",
  "fetchedCount": 1,
  "errorCode": null
}
```

Here `fetchedCount` is required to be greater than zero, not literally equal to one. Confirm no failed G2B operation log and confirm saved notices are returned by the existing tender query path.

- [ ] **Step 7: Apply the production stop condition**

If the signed relay probe itself receives a gateway/WAF or provider rejection, leave fail-closed parsing intact, disable `G2B_RELAY_ENABLED`, and report that a separate Korean-hosted collector with a permitted outbound address is required. Do not broaden success parsing or mark the task complete.

- [ ] **Step 8: Record final evidence**

Record commit SHA, deployment identifiers/statuses, health status codes, safe relay response shape, and safe G2B collect counts in the final handoff. Never record secrets, request URLs with query strings, headers, provider bodies, or raw causes.

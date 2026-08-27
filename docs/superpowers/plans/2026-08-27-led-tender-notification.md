# LED Tender Calendar and Email Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공식 입찰 API의 LED 관련 공고를 하루 두 번 수집하고, 어드민 월간 캘린더 조회와 네이버웍스 일일 이메일 발송을 제공한다.

**Architecture:** 기존 NestJS 애플리케이션에 독립 `tenders` 모듈을 추가하고 출처 어댑터, 규칙 기반 분류, TypeORM 저장소, 조회 API, 구독 설정, 영속 재시도 메일 작업을 분리한다. Nuxt 어드민에는 6주 월 캘린더와 조회 전용 필터, 수신 주소·시각만 관리하는 모달을 추가한다.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL, node-cron 4, Nodemailer, Jest, Nuxt 4, Vue 3, TypeScript, Element Plus, Tailwind CSS, Vitest, Vue Test Utils

**Spec:** `docs/superpowers/specs/2026-08-27-led-tender-notification-design.md`

## Global Constraints

- 공고 수집은 `Asia/Seoul` 기준 매일 `00:00`, `12:00`에만 실행한다.
- 메일은 설정된 시각에 하루 한 번 발송하고 실패 주소만 10분 뒤 한 번 재시도한다.
- 캘린더 조회 필터는 이메일 발송 대상에 영향을 주지 않는다.
- 이메일 설정에는 사용 여부, 최대 20개 수신 주소, 공통 발송 시각만 둔다.
- 직접 관련은 `💡` 청록색, 잠재 관련은 `⚡` 황색으로 표시한다.
- 월 캘린더는 앞뒤 달 날짜를 포함해 항상 7열 × 6주, 42개 셀을 표시한다.
- 공식 API나 정식 제휴가 없는 사이트는 크롤링하지 않는다.
- API 키와 SMTP 자격 증명은 환경 변수에만 저장하며 로그와 API 응답에 포함하지 않는다.
- DB 변경 작업에서 루트 `database-schema.md`를 갱신한다.
- 신규 메뉴 작업에서 `docs/menus/tenders.md`를 갱신한다.

---

## File Map

### Backend

- `dfkorea-backend/src/tenders/domain/*`: 출처 공통 타입, 관련도 분류 규칙
- `dfkorea-backend/src/tenders/entities/*`: 공고, 구독, 수신자, 수집 이력, 메일 이력 엔티티
- `dfkorea-backend/src/tenders/adapters/*`: 나라장터, K-apt, 한전 공식 API 어댑터
- `dfkorea-backend/src/tenders/dto/*`: 조회 및 구독 설정 요청 검증
- `dfkorea-backend/src/tenders/services/*`: 수집, 조회, 구독, 메일, 스케줄 서비스
- `dfkorea-backend/src/tenders/tenders.controller.ts`: JWT 보호 어드민 API
- `dfkorea-backend/src/tenders/tenders.module.ts`: 도메인 조립
- `dfkorea-backend/src/migrations/1787819500000-CreateTenderTables.ts`: 신규 테이블과 인덱스
- `dfkorea-backend/src/app.module.ts`: 엔티티와 모듈 등록

### Frontend

- `led-lighting-website/src/types/tender.ts`: 입찰 화면 전용 타입
- `led-lighting-website/src/api/tenders.ts`: 입찰 API 클라이언트
- `led-lighting-website/src/utils/tender-calendar.ts`: 42개 날짜 셀 생성
- `led-lighting-website/src/components/admin/tenders/*`: 캘린더, 목록, 필터, 상세, 수신 설정
- `led-lighting-website/src/components/admin/TenderManagement.vue`: 입찰 메뉴 상태 조정
- `led-lighting-website/src/views/admin/AdminDashboard.vue`: 입찰 탭 연결

### Documentation

- `database-schema.md`: 전체 DB 스키마와 입찰 테이블 관계
- `docs/menus/tenders.md`: 입찰 공고 메뉴 기능 현황
- `dfkorea-backend/.env.example`: API 및 SMTP 환경 변수
- `DEPLOYMENT.md`: 운영 키 발급과 네이버웍스 설정

---

### Task 1: Tender persistence foundation

**Files:**
- Create: `dfkorea-backend/src/tenders/domain/tender.enums.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-subscription.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-recipient.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-sync-run.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-mail-delivery.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender-mail-item.entity.ts`
- Create: `dfkorea-backend/src/tenders/entities/tender.entities.spec.ts`
- Create: `dfkorea-backend/src/migrations/1787819500000-CreateTenderTables.ts`
- Modify: `dfkorea-backend/src/entities/index.ts`
- Modify: `dfkorea-backend/src/app.module.ts`
- Create: `database-schema.md`

**Interfaces:**
- Produces: `Tender`, `TenderSubscription`, `TenderRecipient`, `TenderSyncRun`, `TenderMailDelivery`, `TenderMailItem`
- Produces enums: `TenderSource`, `ProcurementType`, `TenderRelevance`, `SyncRunStatus`, `MailDeliveryStatus`, `MailItemStatus`

- [ ] **Step 1: Write the failing entity metadata test**

```ts
import { getMetadataArgsStorage } from 'typeorm';
import { Tender } from './tender.entity';
import { TenderMailItem } from './tender-mail-item.entity';

describe('tender entity metadata', () => {
  it('deduplicates source notice revisions', () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) => item.target === Tender && item.name === 'UQ_tender_source_notice_revision',
    );
    expect(unique?.columns).toEqual(['source', 'sourceNoticeId', 'revision']);
  });

  it('tracks one delivery state per recipient and tender', () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) => item.target === TenderMailItem && item.name === 'UQ_tender_mail_item_recipient_tender',
    );
    expect(unique?.columns).toEqual(['recipientId', 'tenderId']);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails because the entities do not exist**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/entities/tender.entities.spec.ts`

Expected: FAIL with module resolution errors for `tender.entity` and `tender-mail-item.entity`.

- [ ] **Step 3: Define exact enums and entities**

```ts
export enum TenderSource { G2B = 'G2B', KAPT = 'KAPT', KEPCO = 'KEPCO' }
export enum ProcurementType { GOODS = 'GOODS', CONSTRUCTION = 'CONSTRUCTION', SERVICE = 'SERVICE', OTHER = 'OTHER' }
export enum TenderRelevance { DIRECT = 'DIRECT', POTENTIAL = 'POTENTIAL' }
export enum SyncRunStatus { RUNNING = 'RUNNING', SUCCEEDED = 'SUCCEEDED', FAILED = 'FAILED' }
export enum MailDeliveryStatus { PENDING = 'PENDING', SENT = 'SENT', FAILED = 'FAILED', RETRY_SCHEDULED = 'RETRY_SCHEDULED', SKIPPED = 'SKIPPED' }
export enum MailItemStatus { PENDING = 'PENDING', SENT = 'SENT' }
```

Implement `Tender` with `@Unique('UQ_tender_source_notice_revision', ['source', 'sourceNoticeId', 'revision'])`, `timestamptz` schedule columns, `bigint` nullable estimated amount, JSONB relevance reasons/raw data, and indexes on `registeredAt`, `source`, `relevance`, `region`, and `procurementType`. Implement the remaining entities and relations exactly as section 7 of the spec defines. `TenderMailDelivery` must include `attemptCount`, `nextRetryAt`, `smtpMessageId`, and `errorMessage`; `TenderMailItem` must include `recipientId`, `tenderId`, `status`, `lastDeliveryId`, and `sentAt`.

- [ ] **Step 4: Add the migration and register all six entities**

The migration must enable `uuid-ossp`, create the six tables, foreign keys with `ON DELETE CASCADE` for subscription recipients and delivery items, both named unique constraints from Step 1, and the query indexes. Add the classes to the explicit `entities` array in `AppModule` and export them from `src/entities/index.ts`.

- [ ] **Step 5: Document the schema and run checks**

Write `database-schema.md` with a Mermaid ER diagram, each table's columns, foreign keys, unique constraints, and update rule. Then run:

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/entities/tender.entities.spec.ts
npm run build
```

Expected: entity test PASS and Nest build succeeds.

- [ ] **Step 6: Commit the persistence foundation**

```bash
git add dfkorea-backend/src/tenders/domain dfkorea-backend/src/tenders/entities dfkorea-backend/src/migrations/1787819500000-CreateTenderTables.ts dfkorea-backend/src/entities/index.ts dfkorea-backend/src/app.module.ts database-schema.md
git commit -m "feat: add tender persistence model"
```

---

### Task 2: Explainable tender classification

**Files:**
- Create: `dfkorea-backend/src/tenders/domain/normalized-tender.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-source.adapter.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-classifier.ts`
- Create: `dfkorea-backend/src/tenders/domain/tender-classifier.spec.ts`

**Interfaces:**
- Produces: `NormalizedTender`, `TenderFetchWindow`, `TenderSourceAdapter`
- Produces: `TenderClassifier.classify(tender): TenderClassification | null`

- [ ] **Step 1: Write failing classification cases**

```ts
describe('TenderClassifier', () => {
  const classifier = new TenderClassifier();

  it.each(['LED 가로등 교체공사', '실내 등기구 구매', '경관조명 제어시스템 구축'])('%s is direct', (title) => {
    expect(classifier.classify({ title, itemName: '', description: '', attachmentNames: [] })?.relevance).toBe(TenderRelevance.DIRECT);
  });

  it('classifies indirect work as potential and explains why', () => {
    expect(classifier.classify({ title: '지하주차장 전기시설 개선공사', itemName: '', description: '', attachmentNames: [] })).toEqual(expect.objectContaining({
      relevance: TenderRelevance.POTENTIAL,
      reasons: expect.arrayContaining([expect.objectContaining({ keyword: '전기시설', field: 'title' })]),
    }));
  });

  it('prefers direct when both classes match', () => {
    expect(classifier.classify({ title: '전기시설 및 LED 조명 개선', itemName: '', description: '', attachmentNames: [] })?.relevance).toBe(TenderRelevance.DIRECT);
  });

  it('returns null for unrelated notices', () => {
    expect(classifier.classify({ title: '구내식당 식자재 구매', itemName: '', description: '', attachmentNames: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the classifier test and verify failure**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/domain/tender-classifier.spec.ts`

Expected: FAIL because `TenderClassifier` does not exist.

- [ ] **Step 3: Implement normalized contracts and weighted rules**

```ts
export interface TenderFetchWindow { from: Date; to: Date }
export interface TenderSourceAdapter {
  readonly source: TenderSource;
  fetchNotices(window: TenderFetchWindow): Promise<NormalizedTender[]>;
}
export interface TenderClassificationReason { field: 'title' | 'itemName' | 'description' | 'attachmentNames'; keyword: string; score: number }
export interface TenderClassification { relevance: TenderRelevance; score: number; reasons: TenderClassificationReason[] }
```

Use direct keywords `LED`, `조명`, `등기구`, `가로등`, `보안등`, `투광등`, `경관조명`, `실내조명`, `조명제어` with score 100. Use potential keywords `전기공사`, `전기시설`, `전기설비`, `시설개선`, `리모델링`, `에너지 절감`, `주차장 개선`, `스마트시티` with score 40. Match case-insensitively across the four fields, de-duplicate identical field/keyword reasons, return direct for score 100 or above, potential for score 40 or above, otherwise return null.

- [ ] **Step 4: Run focused and full backend tests**

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/domain/tender-classifier.spec.ts
npm test -- --runInBand
```

Expected: all classifier cases and existing backend tests PASS.

- [ ] **Step 5: Commit classification**

```bash
git add dfkorea-backend/src/tenders/domain
git commit -m "feat: classify tender relevance"
```

---

### Task 3: Official API adapters

**Files:**
- Create: `dfkorea-backend/src/tenders/adapters/public-api-client.ts`
- Create: `dfkorea-backend/src/tenders/adapters/g2b-tender.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/kapt-tender.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/kepco-tender.adapter.ts`
- Create: `dfkorea-backend/src/tenders/adapters/tender-adapters.spec.ts`
- Create: `dfkorea-backend/src/tenders/adapters/fixtures/g2b-notices.json`
- Create: `dfkorea-backend/src/tenders/adapters/fixtures/kapt-notices.json`
- Create: `dfkorea-backend/src/tenders/adapters/fixtures/kepco-notices.json`
- Create: `docs/references/kepco-tender-api-contract.md`
- Modify: `dfkorea-backend/.env.example`

**Interfaces:**
- Consumes: `TenderSourceAdapter`, `NormalizedTender`, `TenderFetchWindow`
- Produces: providers with tokens `G2B_TENDER_ADAPTER`, `KAPT_TENDER_ADAPTER`, `KEPCO_TENDER_ADAPTER`

- [ ] **Step 1: Add sanitized official-response fixtures and failing mapping tests**

Each fixture must contain one direct and one potential notice using field names copied from the provider's current official OpenAPI response. Tests must assert source, notice ID, revision, title, organization, KST-aware registration/deadline dates, type, region, amount, detail URL, and preserved `rawData`.

```ts
it('normalizes G2B notice identity and dates', async () => {
  client.getAllPages.mockResolvedValue(g2bFixture.response.body.items);
  const [notice] = await adapter.fetchNotices(window);
  expect(notice).toEqual(expect.objectContaining({
    source: TenderSource.G2B,
    sourceNoticeId: 'R26BK00000001',
    revision: '000',
    procurementType: ProcurementType.CONSTRUCTION,
  }));
  expect(notice.registeredAt.toISOString()).toBe('2026-08-26T06:30:00.000Z');
});
```

- [ ] **Step 2: Run adapter tests and verify failure**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts`

Expected: FAIL because adapter files do not exist.

- [ ] **Step 3: Implement a bounded paginated client**

`PublicApiClient.getAllPages<T>()` must use Node 20 global `fetch`, encode query parameters with `URLSearchParams`, require a 2xx response, validate the provider result code, request 100 rows per page, stop at `totalCount`, and cap one collection at 100 pages. Throw a typed `TenderSourceError` containing only source, safe error code, and status; do not include service keys or full response bodies.

- [ ] **Step 4: Implement the three adapters**

Use these environment variables:

```env
PUBLIC_DATA_SERVICE_KEY=
G2B_TENDER_API_BASE_URL=https://apis.data.go.kr/1230000/ad/BidPublicInfoService
KAPT_TENDER_API_BASE_URL=https://apis.data.go.kr/1613000/ApHusBidPblAncInfoOfferServiceV3
KEPCO_TENDER_API_BASE_URL=
KEPCO_TENDER_API_KEY=
```

The G2B adapter must call `getBidPblancListInfoCnstwk`, `getBidPblancListInfoThng`, and `getBidPblancListInfoServc` for the window and merge results. The K-apt adapter must call `getPblAncDeSearchV3` with `startDate`, `endDate`, `pageNo`, and `numOfRows`; map `bidNum`, `bidState`, `bidTitle`, `bidContent`, `bidRegDate`, `bidDeadline`, `bidKaptname`, `bidArea`, and `bidFileSeq`.

The KEPCO dataset is an official `LINK` API whose service URL and response schema are exposed after approval in the KEPCO data portal. Before writing the adapter, apply for the service, download the linked OpenAPI manual, and record the approved base URL, list operation, required date parameters, notice identity fields, and response result code in `docs/references/kepco-tender-api-contract.md`. The adapter and fixture must match that recorded contract exactly; configuration must fail at startup when the KEPCO adapter is enabled without both URL and key. Convert all provider-local date strings to `Date` using `Asia/Seoul`, map unknown procurement types to `OTHER`, and leave unavailable optional fields as `null` rather than fabricated values.

- [ ] **Step 5: Verify adapters**

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/adapters/tender-adapters.spec.ts
npm run build
```

Expected: fixture mapping and pagination tests PASS; build succeeds without real API keys.

- [ ] **Step 6: Commit adapters**

```bash
git add dfkorea-backend/src/tenders/adapters dfkorea-backend/.env.example docs/references/kepco-tender-api-contract.md
git commit -m "feat: add official tender adapters"
```

---

### Task 4: Ingestion and twice-daily collection

**Files:**
- Create: `dfkorea-backend/src/tenders/services/tender-ingestion.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-ingestion.service.spec.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-scheduler.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-scheduler.service.spec.ts`
- Create: `dfkorea-backend/src/tenders/tenders.module.ts`
- Modify: `dfkorea-backend/src/app.module.ts`

**Interfaces:**
- Consumes: three `TenderSourceAdapter` providers and `TenderClassifier`
- Produces: `TenderIngestionService.collectAll(now: Date): Promise<CollectionSummary>`
- Produces: collection cron `0 0 0,12 * * *` in `Asia/Seoul`

- [ ] **Step 1: Write failing ingestion tests**

Cover initial 24-hour window, later `lastSucceededAt - 1 hour` window, irrelevant exclusion, idempotent upsert, revision preservation, independent source failure, sync counters, and advisory lock rejection.

```ts
it('continues after one provider fails', async () => {
  g2b.fetchNotices.mockRejectedValue(new TenderSourceError(TenderSource.G2B, 'UPSTREAM_503', 503));
  kapt.fetchNotices.mockResolvedValue([potentialNotice]);
  await service.collectAll(now);
  expect(tenderRepository.upsert).toHaveBeenCalledTimes(1);
  expect(syncRunRepository.save).toHaveBeenCalledWith(expect.objectContaining({ source: TenderSource.G2B, status: SyncRunStatus.FAILED }));
  expect(syncRunRepository.save).toHaveBeenCalledWith(expect.objectContaining({ source: TenderSource.KAPT, status: SyncRunStatus.SUCCEEDED }));
});
```

- [ ] **Step 2: Run ingestion tests and verify failure**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/services/tender-ingestion.service.spec.ts`

Expected: FAIL because ingestion and scheduler services do not exist.

- [ ] **Step 3: Implement transactional source ingestion**

For each source, create a `RUNNING` sync row, calculate its window, fetch notices, classify, and `upsert` on `['source', 'sourceNoticeId', 'revision']`. Save exact `fetchedCount`, `createdCount`, `updatedCount`, and `excludedCount`. Catch errors per source, sanitize the error, mark only that run failed, and return a combined summary.

- [ ] **Step 4: Implement durable collection scheduling and module registration**

Acquire `pg_try_advisory_lock(824001)` before collection and always release it in `finally`. Schedule only `0 0 0,12 * * *` with `timezone: 'Asia/Seoul'` and `noOverlap: true`. Register entities, adapters, classifier, ingestion, and scheduler in `TendersModule`, then import `TendersModule` from `AppModule`.

- [ ] **Step 5: Run service tests and build**

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/services/tender-ingestion.service.spec.ts src/tenders/services/tender-scheduler.service.spec.ts
npm run build
```

Expected: window, partial failure, lock, and exact cron tests PASS.

- [ ] **Step 6: Commit ingestion**

```bash
git add dfkorea-backend/src/tenders/services dfkorea-backend/src/tenders/tenders.module.ts dfkorea-backend/src/app.module.ts
git commit -m "feat: schedule tender collection"
```

---

### Task 5: Calendar and tender query API

**Files:**
- Create: `dfkorea-backend/src/tenders/dto/tender-query.dto.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-query.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-query.service.spec.ts`
- Create: `dfkorea-backend/src/tenders/tenders.controller.ts`
- Create: `dfkorea-backend/src/tenders/tenders.controller.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`

**Interfaces:**
- Produces: `GET /tenders/calendar` (목록과 동일한 조회 전용 필터 지원), `GET /tenders`, `GET /tenders/:id`
- Produces response types: `TenderCalendarDayDto`, `PaginatedTenderDto` with `{ data, total, page, pageSize, totalPages }`, `TenderDetailDto`

- [ ] **Step 1: Write failing query and guard tests**

Test a KST month boundary, 42-day response coverage support, direct/potential counts, combined filters, newest-first pagination, not-found behavior, and `JwtAuthGuard` metadata on all controller methods.

```ts
it('groups by registered date in Asia/Seoul', async () => {
  repository.createQueryBuilder.mockReturnValue(calendarQueryReturning([
    { date: '2026-08-01', relevance: TenderRelevance.DIRECT, count: '2' },
    { date: '2026-08-01', relevance: TenderRelevance.POTENTIAL, count: '3' },
  ]));
  await expect(service.getCalendar('2026-08')).resolves.toEqual([
    { date: '2026-08-01', total: 5, direct: 2, potential: 3 },
  ]);
});
```

- [ ] **Step 2: Run query tests and verify failure**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/services/tender-query.service.spec.ts src/tenders/tenders.controller.spec.ts`

Expected: FAIL because DTO, service, and controller are absent.

- [ ] **Step 3: Implement validated DTOs and repository queries**

Validate `month` with `/^\d{4}-(0[1-9]|1[0-2])$/`, `registeredDate` with ISO `YYYY-MM-DD`, enums with `@IsEnum`, page 1 or greater, and pageSize 1–100. Calendar SQL must group `(registeredAt AT TIME ZONE 'Asia/Seoul')::date`. List filters must be parameterized and keyword search must use `ILIKE` against title and both organizations.

- [ ] **Step 4: Add JWT-protected controller routes**

Place `@UseGuards(JwtAuthGuard)` at controller class level. Declare `calendar` and `subscription` static routes before `:id`. Return `NotFoundException` for an unknown UUID.

- [ ] **Step 5: Verify query API**

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/services/tender-query.service.spec.ts src/tenders/tenders.controller.spec.ts
npm run build
```

Expected: query tests PASS and build succeeds.

- [ ] **Step 6: Commit query API**

```bash
git add dfkorea-backend/src/tenders/dto/tender-query.dto.ts dfkorea-backend/src/tenders/services/tender-query.service.ts dfkorea-backend/src/tenders/services/tender-query.service.spec.ts dfkorea-backend/src/tenders/tenders.controller.ts dfkorea-backend/src/tenders/tenders.controller.spec.ts dfkorea-backend/src/tenders/tenders.module.ts
git commit -m "feat: expose tender calendar API"
```

---

### Task 6: Shared recipient and send-time settings

**Files:**
- Create: `dfkorea-backend/src/tenders/dto/update-tender-subscription.dto.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-subscription.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-subscription.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`

**Interfaces:**
- Produces: `GET /tenders/subscription`, `PUT /tenders/subscription`
- Produces: `TenderSubscriptionService.getOrCreate()` and `update(dto)`

- [ ] **Step 1: Write failing validation and atomic-update tests**

```ts
it('normalizes, deduplicates, and replaces recipients atomically', async () => {
  await service.update({ enabled: true, deliveryTime: '09:00', recipients: [' Sales@DFKorea.co.kr ', 'sales@dfkorea.co.kr'] });
  expect(recipientRepository.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'sales@dfkorea.co.kr' }));
  expect(recipientRepository.save).toHaveBeenCalledTimes(1);
});
```

Also assert rejection of invalid email, 21 recipients, empty recipients while enabled, and times outside `00:00`–`23:59`.

- [ ] **Step 2: Run subscription tests and verify failure**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/services/tender-subscription.service.spec.ts`

Expected: FAIL because subscription service does not exist.

- [ ] **Step 3: Implement DTO and transaction**

Use `@IsBoolean`, `@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)`, `@ArrayMaxSize(20)`, `@ArrayUnique((email) => email.trim().toLowerCase())`, and `@IsEmail({}, { each: true })`. In one TypeORM transaction, upsert the single subscription row, replace recipients, and return sorted normalized addresses.

- [ ] **Step 4: Expose the settings routes**

Add `GET /tenders/subscription` and `PUT /tenders/subscription` to the guarded controller. Do not accept keyword, source, region, type, or relevance properties; the global `forbidNonWhitelisted` pipe must reject them. Dynamic mail rescheduling is connected in Task 7 after the mail service exists.

- [ ] **Step 5: Verify settings API**

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/services/tender-subscription.service.spec.ts src/tenders/tenders.controller.spec.ts
npm run build
```

Expected: validation, atomic replacement, forbidden filter property, and rescheduling tests PASS.

- [ ] **Step 6: Commit subscription settings**

```bash
git add dfkorea-backend/src/tenders/dto/update-tender-subscription.dto.ts dfkorea-backend/src/tenders/services/tender-subscription.service* dfkorea-backend/src/tenders/tenders.controller* dfkorea-backend/src/tenders/tenders.module.ts
git commit -m "feat: manage tender email recipients"
```

---

### Task 7: NAVER WORKS digest delivery and durable retry

**Files:**
- Modify: `dfkorea-backend/package.json`
- Modify: `dfkorea-backend/package-lock.json`
- Create: `dfkorea-backend/src/tenders/mail/tender-mail-renderer.ts`
- Create: `dfkorea-backend/src/tenders/mail/tender-mail-renderer.spec.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-mail.service.ts`
- Create: `dfkorea-backend/src/tenders/services/tender-mail.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-scheduler.service.ts`
- Modify: `dfkorea-backend/src/tenders/services/tender-scheduler.service.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.controller.spec.ts`
- Modify: `dfkorea-backend/src/tenders/tenders.module.ts`
- Modify: `dfkorea-backend/.env.example`

**Interfaces:**
- Produces: `TenderMailRenderer.render(date, tenders): { subject: string; html: string; text: string }`
- Produces: `TenderMailService.sendDailyDigest(now)` and `retryDue(now)`
- Produces: retry scan cron `0 * * * * *`

- [ ] **Step 1: Install mail dependencies**

Run: `cd dfkorea-backend && npm install nodemailer && npm install -D @types/nodemailer`

Expected: package manifest and lockfile include Nodemailer packages.

- [ ] **Step 2: Write failing renderer and delivery tests**

Assert direct/potential section separation, escaped HTML, text alternative, zero-item `SKIPPED`, one SMTP send per address, only successful address items marked `SENT`, failure scheduled at exactly `now + 10 minutes`, retry only at attempt 2, final failure remains pending, and pending items included next day.

```ts
it('retries only the failed recipient ten minutes later', async () => {
  transport.sendMail.mockRejectedValueOnce(new Error('temporary SMTP failure'));
  await service.sendDailyDigest(now);
  expect(deliveryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
    status: MailDeliveryStatus.RETRY_SCHEDULED,
    attemptCount: 1,
    nextRetryAt: new Date(now.getTime() + 10 * 60_000),
  }));
  expect(mailItemRepository.update).not.toHaveBeenCalledWith(expect.anything(), { status: MailItemStatus.SENT });
});
```

- [ ] **Step 3: Run mail tests and verify failure**

Run: `cd dfkorea-backend && npm test -- --runInBand src/tenders/mail/tender-mail-renderer.spec.ts src/tenders/services/tender-mail.service.spec.ts`

Expected: FAIL because renderer and service are absent.

- [ ] **Step 4: Implement SMTP transport and renderer**

Create one Nodemailer transport with `host: SMTP_HOST`, `port: 465`, `secure: true`, and `auth` from `SMTP_USER`/`SMTP_APP_PASSWORD`. Render subject `[DF KOREA 입찰정보] YYYY-MM-DD 신규 공고 N건`; include counts, two relevance sections, organization, source, registered/deadline dates, region, type, amount, reason, and official link. Escape every external string before inserting it into HTML.

- [ ] **Step 5: Implement per-recipient delivery and persistent retry**

Select all `PENDING` recipient/tender pairs plus newly eligible tenders, send one message per recipient, and mark pairs `SENT` only after SMTP success. On first failure, set `RETRY_SCHEDULED`, `attemptCount = 1`, and `nextRetryAt`; `retryDue` changes it to attempt 2. On second failure, mark delivery `FAILED` and leave items pending. Record `SKIPPED` when no pending items exist.

Add these exact variables:

```env
SMTP_HOST=smtp.worksmobile.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_APP_PASSWORD=
SMTP_FROM_NAME=DF KOREA 입찰정보
CRON_TIMEZONE=Asia/Seoul
```

- [ ] **Step 6: Add dynamic daily schedule and retry recovery scan**

On startup, load subscription settings and schedule `0 {minute} {hour} * * *`. Destroy the previous task before rescheduling. After `PUT /tenders/subscription` succeeds, the controller must call `TenderSchedulerService.rescheduleDailyMail(deliveryTime, enabled)`. Every minute run `retryDue(new Date())`; the DB `nextRetryAt` makes retry survive process restarts. Protect daily send with advisory lock `824002` and retry scan with `824003`.

- [ ] **Step 7: Verify mail behavior**

```bash
cd dfkorea-backend
npm test -- --runInBand src/tenders/mail src/tenders/services/tender-mail.service.spec.ts src/tenders/services/tender-scheduler.service.spec.ts
npm run build
```

Expected: renderer, per-recipient result, exact one-retry limit, restart recovery, and dynamic cron tests PASS.

- [ ] **Step 8: Commit mail delivery**

```bash
git add dfkorea-backend/package.json dfkorea-backend/package-lock.json dfkorea-backend/src/tenders/mail dfkorea-backend/src/tenders/services/tender-mail.service* dfkorea-backend/src/tenders/services/tender-scheduler.service* dfkorea-backend/src/tenders/tenders.controller* dfkorea-backend/src/tenders/tenders.module.ts dfkorea-backend/.env.example
git commit -m "feat: send tender digests through NAVER WORKS"
```

---

### Task 8: Frontend tender contracts and 42-day calendar

**Files:**
- Modify: `led-lighting-website/package.json`
- Modify: `led-lighting-website/package-lock.json`
- Create: `led-lighting-website/vitest.config.ts`
- Create: `led-lighting-website/src/types/tender.ts`
- Modify: `led-lighting-website/src/types/index.ts`
- Create: `led-lighting-website/src/api/tenders.ts`
- Modify: `led-lighting-website/src/api/index.ts`
- Create: `led-lighting-website/src/utils/tender-calendar.ts`
- Create: `led-lighting-website/src/utils/tender-calendar.spec.ts`
- Create: `led-lighting-website/src/components/admin/tenders/TenderRelevanceBadge.vue`

**Interfaces:**
- Produces: `Tender`, `TenderCalendarDay`, `TenderQuery`, `TenderSubscription`, `UpdateTenderSubscription`
- Produces: `tendersAPI.getCalendar/getAll/getOne/getSubscription/updateSubscription`
- Produces: `buildMonthCells(year, month, counts): TenderCalendarCell[]`

- [ ] **Step 1: Add frontend test tooling**

Run: `cd led-lighting-website && npm install -D vitest @vue/test-utils happy-dom`

Add scripts `"test": "vitest run"` and `"test:watch": "vitest"`. Configure Vue plugin, `happy-dom`, and alias `@` to `src` in `vitest.config.ts`.

- [ ] **Step 2: Write the failing calendar utility test**

```ts
it('always builds six complete weeks for August 2026', () => {
  const cells = buildMonthCells(2026, 7, new Map());
  expect(cells).toHaveLength(42);
  expect(cells[0].date).toBe('2026-07-26');
  expect(cells[41].date).toBe('2026-09-05');
  expect(cells.filter((cell) => cell.inCurrentMonth)).toHaveLength(31);
});
```

- [ ] **Step 3: Run the utility test and verify failure**

Run: `cd led-lighting-website && npm test -- src/utils/tender-calendar.spec.ts`

Expected: FAIL because the utility does not exist.

- [ ] **Step 4: Implement typed API and calendar utility**

Use ISO strings at the API boundary, explicit enums matching backend values, and a tender-specific paginated response containing `pageSize`. `buildMonthCells` must start on the Sunday before or equal to the first day, produce exactly 42 cells, preserve KST date strings without `new Date('YYYY-MM-DD')` UTC drift, and fill missing counts with zero.

- [ ] **Step 5: Implement the reusable relevance badge**

`TenderRelevanceBadge` accepts `DIRECT | POTENTIAL`, renders `lightbulb`/`bolt` Material Symbols, Korean label, and accessible text. Keep this feature component under `components/admin/tenders`; use the existing common `BaseButton` and `BaseCard` for buttons and cards instead of creating local replacements.

- [ ] **Step 6: Verify frontend foundation**

```bash
cd led-lighting-website
npm test -- src/utils/tender-calendar.spec.ts
npm run type-check
```

Expected: 42-day test PASS and TypeScript check succeeds.

- [ ] **Step 7: Commit frontend contracts**

```bash
git add led-lighting-website/package.json led-lighting-website/package-lock.json led-lighting-website/vitest.config.ts led-lighting-website/src/types led-lighting-website/src/api led-lighting-website/src/utils/tender-calendar* led-lighting-website/src/components/admin/tenders/TenderRelevanceBadge.vue
git commit -m "feat: add tender frontend contracts"
```

---

### Task 9: Admin calendar, filters, details, and recipient settings

**Files:**
- Create: `led-lighting-website/src/components/admin/tenders/TenderCalendar.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderCalendar.spec.ts`
- Create: `led-lighting-website/src/components/admin/tenders/TenderFilterPanel.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderList.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderDetailModal.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderSubscriptionModal.vue`
- Create: `led-lighting-website/src/components/admin/tenders/TenderSubscriptionModal.spec.ts`
- Create: `led-lighting-website/src/components/admin/TenderManagement.vue`
- Create: `led-lighting-website/src/components/admin/TenderManagement.spec.ts`
- Modify: `led-lighting-website/src/views/admin/AdminDashboard.vue`
- Create: `docs/menus/tenders.md`

**Interfaces:**
- Consumes: Task 8 types, API, calendar utility, `BaseButton`, `BaseCard`, `BaseModal`, `LoadingSpinner`, `EmptyState`
- Produces: new `tenders` admin tab

- [ ] **Step 1: Write failing component behavior tests**

Test 42 cells and six rows, adjacent-month muted state, date selection, filter application/reset, API params independent from subscription, recipient add/remove/deduplicate, invalid email/time errors, max 20 recipients, save payload containing only `enabled`, `deliveryTime`, and `recipients`, loading/empty/error rendering, and direct/potential counts.

```ts
it('does not copy calendar filters into subscription payload', async () => {
  const wrapper = mount(TenderManagement, { global: testGlobals });
  await wrapper.get('[data-test="filter-keyword"]').setValue('서울');
  await wrapper.get('[data-test="open-subscription"]').trigger('click');
  await wrapper.get('[data-test="save-subscription"]').trigger('click');
  expect(tendersAPI.updateSubscription).toHaveBeenCalledWith({
    enabled: true,
    deliveryTime: '09:00',
    recipients: ['sales@dfkorea.co.kr'],
  });
});
```

- [ ] **Step 2: Run component tests and verify failure**

Run: `cd led-lighting-website && npm test -- src/components/admin/tenders src/components/admin/TenderManagement.spec.ts`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement calendar and summary cards**

Render three summary `BaseCard` components, month navigation, weekday header, and the 42 cells. A selected date drives the list request by `registeredDate`. Desktop shows label badges; tablet/mobile cells show only icons and numbers. Adjacent-month dates stay visible and clicking one navigates to that month.

- [ ] **Step 4: Implement independent calendar filter and list/detail states**

Filter fields are keyword, source, region, procurement type, and relevance. `적용` resets page to 1 and queries the selected date; `초기화` clears only these five fields. The list uses desktop rows and mobile cards, opens `TenderDetailModal`, and sends official links with `target="_blank"` and `rel="noopener noreferrer"`.

- [ ] **Step 5: Implement recipient settings modal**

Use an email chip list, `type="time"`, enabled toggle, and save/cancel buttons. Normalize email to lower case, prevent duplicates, cap at 20, require at least one email only when enabled, and show the fixed note: `캘린더 필터와 무관하게 모든 신규 관련 공고가 발송됩니다.`

- [ ] **Step 6: Compose TenderManagement and connect the tab**

Add `{ id: 'tenders', icon: 'calendar_month', label: '입찰 공고' }` to `AdminDashboard.tabs`, import `TenderManagement`, and render it for `activeTab === 'tenders'`. Preserve the existing query-string tab restoration and mobile sidebar behavior.

- [ ] **Step 7: Create the menu status document**

Write `docs/menus/tenders.md` with the required sections `구현 완료`, `미구현`, `부족하거나 개선이 필요한 기능`, `관련 파일`, `갱신 규칙`. Mark API-key approval and real provider validation as operational limitations until verified; do not label fixture-only integrations as fully complete.

- [ ] **Step 8: Verify UI and build**

```bash
cd led-lighting-website
npm test -- src/components/admin/tenders src/components/admin/TenderManagement.spec.ts
npm run type-check
npm run build
```

Expected: component tests PASS, type check succeeds, and Nuxt production build succeeds.

- [ ] **Step 9: Commit admin UI**

```bash
git add led-lighting-website/src/components/admin/tenders led-lighting-website/src/components/admin/TenderManagement* led-lighting-website/src/views/admin/AdminDashboard.vue docs/menus/tenders.md
git commit -m "feat: add tender admin calendar"
```

---

### Task 10: Deployment documentation and end-to-end verification

**Files:**
- Modify: `DEPLOYMENT.md`
- Modify: `dfkorea-backend/.env.example`
- Modify: `database-schema.md`
- Modify: `docs/menus/tenders.md`
- Create: `dfkorea-backend/test/tenders.e2e-spec.ts`
- Create: `dfkorea-backend/test/setup-test-env.ts`
- Modify: `dfkorea-backend/test/jest-e2e.json`

**Interfaces:**
- Verifies the complete authenticated flow without live external API or SMTP calls

- [ ] **Step 1: Write the failing e2e flow with mocked adapters and SMTP**

The test app must override the three adapter tokens and mail transport provider. Test unauthorized rejection, collection creating one direct and one potential notice, calendar counts on registered date, filtered list, subscription storage, successful two-recipient send, and one-recipient retry without duplicate delivery to the successful recipient.

```ts
await request(app.getHttpServer())
  .get('/tenders/calendar?month=2026-08')
  .set('Authorization', `Bearer ${adminToken}`)
  .expect(200)
  .expect(({ body }) => expect(body).toContainEqual({ date: '2026-08-27', total: 2, direct: 1, potential: 1 }));
```

- [ ] **Step 2: Run e2e and verify failure before wiring final test overrides**

Run: `cd dfkorea-backend && npm run test:e2e -- --runInBand test/tenders.e2e-spec.ts`

Expected: FAIL until test database, adapter tokens, and SMTP transport overrides are connected.

- [ ] **Step 3: Complete e2e harness and documentation**

In `setup-test-env.ts`, copy `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD`, and `TEST_DB_NAME` into the existing `DB_*` variables before `AppModule` loads. Register the setup file through `setupFiles` in `jest-e2e.json`. Run the tender migration before the suite and truncate only the six tender tables between tests. Document public-data key applications, KEPCO key, Railway variables, migration command, NAVER WORKS SMTP permission, external app password creation, and safe key rotation. Never print secret example values.

- [ ] **Step 4: Run complete backend verification**

```bash
cd dfkorea-backend
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand test/tenders.e2e-spec.ts
npm run build
```

Expected: lint exits 0, all unit/e2e tests PASS, and Nest build succeeds.

- [ ] **Step 5: Run complete frontend verification**

```bash
cd led-lighting-website
npm run lint
npm test
npm run type-check
npm run build
```

Expected: lint exits 0, all Vitest tests PASS, type check succeeds, and Nuxt build succeeds.

- [ ] **Step 6: Perform a staging smoke test with real credentials**

Apply migrations to staging, configure the three API credentials and NAVER WORKS SMTP variables, deploy before the next scheduled `00:00` or `12:00` KST run, and verify after that run: source records exist, no secret appears in logs, calendar counts equal DB counts, and duplicate source identifiers are absent. Set one staging recipient and the next available daily delivery time, then verify one digest arrives and a second manual page refresh does not trigger another mail.

- [ ] **Step 7: Update status documents from verified evidence**

Move only staging-verified providers into `구현 완료`. Keep any provider without approved credentials or successful live response under `부족하거나 개선이 필요한 기능` with the exact failed prerequisite. Confirm `database-schema.md` matches the applied migration.

- [ ] **Step 8: Commit verification and operations docs**

```bash
git add DEPLOYMENT.md dfkorea-backend/.env.example dfkorea-backend/test database-schema.md docs/menus/tenders.md
git commit -m "docs: add tender operations and verification"
```

---

## Final Acceptance Checklist

- [ ] `00:00` and `12:00` KST are the only collection schedules.
- [ ] Initial window is 24 hours; later windows start one hour before each source's last success.
- [ ] Provider failures are isolated and visible in `tender_sync_runs`.
- [ ] Direct and potential classifications expose exact reasons.
- [ ] Calendar groups by KST registration date and always renders 42 cells.
- [ ] Calendar filters never alter the email payload or recipient selection.
- [ ] Subscription accepts only enabled, recipients, and delivery time.
- [ ] Successful recipients never receive a duplicate tender.
- [ ] Failed recipients retry once after 10 minutes and retain pending items after final failure.
- [ ] NAVER WORKS credentials and public API keys never appear in responses or logs.
- [ ] `database-schema.md` and `docs/menus/tenders.md` match verified behavior.
- [ ] Backend lint, unit tests, e2e tests, and build pass.
- [ ] Frontend lint, unit tests, type-check, and build pass.

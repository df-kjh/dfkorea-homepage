# Online Quote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** 공개 사이트에서 검증된 기업의 제품·직접 입력 사양·사진 견적 요청을 접수하고 지정 메일로 발송한다.

**Architecture:** Nuxt 전역 메모리 작성 상태와 3단계 팝업을 NestJS 익명 세션·국세청 검증·접수 API에 연결한다. PostgreSQL 접수와 메일 outbox를 트랜잭션으로 기록하고, 비공개 사진 저장과 기존 NAVER WORKS 전송을 사용한다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, NestJS 10, TypeORM, PostgreSQL, Sharp, NAVER WORKS HTTPS API.

**Spec:** `docs/superpowers/specs/2026-09-06-online-quote-design.md`

## Global Constraints

- 격리 경로 `/Users/kim-jh/Documents/dfkorea-homepage/.worktrees/online-quote`, 기준 커밋 `d304130`. 현재 사용자 변경을 담은 기준이므로 최종 반영은 이 커밋 이후 변경만 가져온다.
- 공개 전역 우하단 버튼, 440px 팝업, 640px 미만 하단 시트, 키보드·포커스·동작 줄이기 지원.
- 회사명·사업자번호·대표자명·개업일자·담당자·이메일 필수, 전화 선택.
- 사업자번호만 확인하거나 mock 성공으로 우회하지 않는다. 국세청 요청에 상호를 포함하고 응답의 진위 및 정상영업을 확인한다.
- 최대 20품목, 정수 수량 1~999999, 사진 요청 전체 3장·원본 장당 5MB·40MP, 비공개 보관, 메일 첨부 전체 6MB 이하.
- 수신자 `kymkjh2002@dfkorealed.com` 고정, 제품 정보는 서버 카탈로그 스냅샷, 개인정보는 브라우저 영구 저장 금지.
- 비밀값·실제 사업자 정보 외부 전송·운영 DB 마이그레이션·실제 이메일 발송 없이 구현과 로컬 검증을 완료한다. 운영 연결은 실제 설정과 승인된 검증 데이터가 필요하다.
- 프로덕션 synchronize 금지. 의미 있는 로직 테스트는 RED → GREEN. 에이전트는 할당 파일만 수정하고 커밋하지 않는다.

## 공통 API 계약 (프론트/백엔드 공유)

별도 공개 견적 axios 클라이언트 사용. 기존 관리자 401 리다이렉트 인터셉터를 사용하지 않는다. 익명 작성 세션 토큰은 브라우저 메모리에만 보관하고 `Authorization: Bearer <sessionToken>`으로 전달한다. 기존 CORS 허용 헤더를 이용한다.

```ts
type Company = { companyName: string; businessNumber: string; representativeName: string;
  openingDate: string; contactName: string; email: string; phone?: string };
type QuoteItem = { clientId: string; kind: 'catalog' | 'custom'; productId?: string;
  name?: string; quantity: number; power?: number; colorTemp?: number;
  dimensions?: string; certifications: string[]; options: string[];
  description?: string; attachmentIds: string[] };
type QuoteSubmission = { idempotencyKey: string; verificationToken: string;
  company: Company; items: QuoteItem[]; notes?: string; requestedDeliveryDate?: string;
  consentVersion: string };
```

- `POST /quotes/sessions` body `{}` → `{ sessionToken, expiresAt, privacy: { version, retentionDays } }`.
- `POST /quotes/business-verifications` body `{ companyName, businessNumber, representativeName, openingDate, consentVersion }` → `{ verificationToken, expiresAt }`.
- `POST /quotes/attachments` multipart `file` + `clientAttachmentId`(사진별 고정 UUID) → `{ id, name, mimeType, size }`; `DELETE /quotes/attachments/:id` → `{ success: true }`.
- 같은 세션·사진 식별자·파일의 업로드 재시도는 같은 첨부를 반환한다. 변경된 파일은 거절하며 교체 사진에는 새 식별자를 부여한다.
- `POST /quotes` body `QuoteSubmission` → `{ reference, status: 'RECEIVED' }`. 같은 키·같은 내용의 재시도는 같은 접수번호를 반환하고 내용이 변경되면 409를 반환한다.
- 공개 오류는 Nest 형식 `{statusCode, message, code?}`. 만료 401/410, 입력 불일치 400/422, 충돌 409, 호출 제한 429, 외부 설정·장애 503. 401에서 관리자 로그인으로 이동하지 않는다.
- `GET /products?page=1&limit=10&search=...&category=...&power=20,40&colorTemp=3000,5700&certifications=KC,고효율&options=...` → 기존 `{ data,total,page,limit,totalPages }`.
- `GET /products/filter-options` → `{ categories:string[], power:number[], colorTemp:number[], certifications:string[], options:string[] }`.
- 같은 조건 내 OR, 서로 다른 조건 간 AND. 전체 필터 후 페이지를 나누며 제품명·모델명을 검색한다.
- 메일 전송 계약: `NaverWorksMailTransport.sendMail({to,subject,html,text,fromName?,attachments?:{filename,fileType,data}[]})`.

## Task 1 — 기업 검증·비공개 첨부·접수 저장 (backend agent)

**Files:** create `dfkorea-backend/src/quotes/**`, timestamped migration; modify `src/app.module.ts`, `src/database/typeorm.config.ts`, `.env.example`, `database-schema.md`. 기존 제품·메일 전송 파일은 Task 3이 담당한다.

**Interfaces:** 위 공개 계약을 구현하고 Task 3의 메일 전송 및 OAuth export를 사용한다. 기존 TypeORM 제품 Repository에서 카탈로그를 읽는다.

- [x] 세션 만료·정보 변경·다른 세션의 토큰/첨부 참조 거절·잘못된 상호·NTS 비정상 응답·중복 접수 테스트를 먼저 추가하고 실패를 기록한다.
- [x] DTO와 서비스 경계를 구현한다: session service, NTS verifier, private attachment storage, submission transaction, mail renderer, outbox worker. 공유·운영 DB에 연결하지 않고 검증한다.
- [x] 중첩 DTO·배열 길이·이미지 디코딩·IP/세션 호출 제한·정확한 Origin 허용 목록·HTML 이스케이프·서버 카탈로그 스냅샷·원자적 소유권/중복 방지를 검증한다.
- [x] 마이그레이션·엔티티 검색·비공개 저장 정리·관리자 인증 목록/사진/재전송 API·설정 예시·운영 절차·database-schema를 갱신한다.
- [x] 대상 Jest·타입 검사·백엔드 빌드를 실행하고 결과와 필요한 설정을 보고한다.

Core assertions:
```ts
expect(await verifyNts(validCompany)).toEqual(expect.objectContaining({ verified: true }));
await expect(verifyNts({ ...validCompany, companyName: '틀린 상호' })).rejects.toThrow();
expect((await submit(sameRequest)).reference).toBe((await submit(sameRequest)).reference);
await expect(submit({ ...sameRequest, items: changedItems })).rejects.toThrow();
```

## Task 2 — 전체 UI와 사이트 연결 (frontend agent)

**Files:** create `led-lighting-website/src/components/quote/**`, `components/common/quote/**`, `composables/useQuoteDraft.ts`, `api/quotes.ts`, `types/quote.ts`; modify `src/app.vue`, `components/home/CtaSection.vue`, `pages/products/[id].vue`, `views/ProductsView.vue`, `api/index.ts`; docs `docs/menus/home.md`, `products.md`, new `quote.md` and menu index.

**Interfaces:** 위 API 계약을 사용한다. 기존 호출과 호환되는 `productsAPI.getPaginated(page,limit,search?,category?,filters?)`, `getFilterOptions()`를 추가한다. Nuxt SSR의 사용자 간 singleton 공유를 금지하고 개인 정보는 클라이언트에서 생성한 메모리 상태로만 유지한다.

- [x] 작성 상태 유지·검증 정보 변경 시 무효화·동일 제품/사양 수량 합산·다른 사양 분리·사진 3장/20품목/수량 한도를 테스트부터 구현한다.
- [x] 3단계 폼·사양 선택과 상담 후 결정·실제 API 검색/필터/결과·직접 입력 사진·확인/접수/오류/성공 화면을 구현한다.
- [x] 공개 전역 버튼과 맨 위로 버튼 배치·기존 CTA/상세 진입·모바일 모달 포커스/키보드·PC 비모달·동작 줄이기·본문 스크롤·라우트 간 메모리 유지를 구현한다.
- [x] 실패 시 입력/첨부/중복 요청 키 유지·명확한 입력 검증·업로드 재시도·오래된 비동기 응답 무시·최소화 유지·성공 후 초기화를 구현한다.
- [x] 메뉴 문서의 구현/미구현/개선점/관련 파일/갱신 규칙을 갱신한다. Vitest·타입 검사·Nuxt 빌드로 검증한다.

Core assertions:
```ts
expect(addCatalogItem(existing, sameSpecification).length).toBe(1);
expect(addCatalogItem(existing, differentSpecification).length).toBe(2);
expect(changeCompany(verifiedDraft, { companyName: '변경' }).verificationToken).toBeNull();
```

## Task 3 — 제품 검색과 메일 공통 기능 (integration agent)

**Files:** modify `dfkorea-backend/src/products/products.controller.ts`, `products.service.ts`, new filter DTO/helper/tests; `src/tenders/mail/naver-works-mail.transport.ts` and test; `src/tenders/tenders.module.ts` exports OAuth service or separate minimal common module preserving existing imports.

**Interfaces:** 필터 API와 메일 attachments/fromName 계약을 Task 1/2에 제공한다.

- [x] 검색 AND/OR·모델명·페이지 경계·빈 배열·잘못된 필터·안정적인 정렬·filter-options 라우트 우선순위를 테스트부터 구현한다.
- [x] 전체 필터 후 페이지 분할·조건 미지정 시 기존 계약 유지·실제 카탈로그 기반 선택지를 구현한다.
- [x] Base64 첨부 전송·fromName 재정의·기존 입찰 메일 호환을 테스트부터 구현한다. 첨부가 없는 기존 요청은 같은 payload를 사용한다.
- [x] 202/429/401/불명 결과 분류와 OAuth 재사용을 유지하고 대상 Jest·타입 검사를 실행한다.

Core assertions:
```ts
expect(filterProducts(products,{ search:'MODEL',power:[40],certifications:['KC'] })).toEqual([matching]);
expect(JSON.parse(requestBody).attachments[0]).toEqual({filename:'photo.jpg',fileType:'image/jpeg',data:base64});
```

## Task 4 — 통합·리뷰·검증 (orchestrator + reviewer)

- [x] 각 결과와 계약을 대조하고 체크리스트를 갱신한다. 담당 파일 충돌을 해결한다.
- [x] 별도 에이전트에게 요구사항·품질·보안 리뷰를 맡기고 담당자에게 수정 사항을 전달해 결과를 확인한다.
- [x] 프론트 테스트/타입 검사/빌드와 백엔드 테스트/린트/컴파일 엔티티 검색/빌드를 실행한다. DB 통합 테스트는 독립 테스트 DB만 사용한다.
- [x] localhost에서 PC/모바일 UI를 확인하고 외부 API가 없을 때 통신 경계를 대체한 계약 테스트와 실제 연동 한계를 기록한다.
- [x] `d304130` 이후 기능 변경만 원래 작업 복사본에 반영한다. 기존 미커밋 변경을 보존하고 diff를 검사한다.
- [x] 완료 내용·실행한 검증·운영 연결에 필요한 설정을 간결하게 보고한다.

## Preflight / rulings

| Task pair | Shared contract / ownership | Result |
| --- | --- | --- |
| 1 ↔ 2 | Sessions, verification, attachments, submit | 이 문서의 계약을 기준으로 하며 변경은 메인에 알린다 |
| 1 ↔ 3 | NAVER WORKS transport / OAuth | 3은 전송/export, 1은 quotes 의존성 주입과 app.module을 담당 |
| 2 ↔ 3 | Product query options | 3은 백엔드, 2는 프론트 API/UI 담당. 기존 4인자 호출 호환 |
| 1 | Entities/migration/discovery/schema | 한 담당자가 함께 관리하고 일치 여부 검사 |
| 2 | Privacy/verification/async draft | 서버 검증 결과를 화면의 자체 성공 상태로 대체하지 않음 |
| 3 | Legacy mail and product contract | 새 조건을 생략하면 기존 동작을 유지 |

Ruling: 사용자가 구현을 승인했고 AGENTS의 대규모 작업 위임 지침이 있으므로 독립된 세 영역을 병렬 구현한다.
Ruling: 개인 정보 보유기간 기본값은 365일이며 환경변수로 변경 가능하다. 동의 안내와 실제 삭제에 같은 값을 사용한다. 최종 운영 연결 때 회사 방침과 대조한다.
Ruling: 공개 제품 R2 버킷을 재사용하지 않고 전용 비공개 견적 버킷을 요구한다. 미설정 시 공개 저장으로 전환하지 않는다. 개발용 저장은 public uploads 밖에 둔다.
Ruling: 동시 작업 중 각 에이전트는 커밋하지 않는다. 메인이 결과를 통합한 뒤 기능 변경만 커밋·반영한다.

## Progress

- [x] 설계 승인: 사용자 ‘진행해줘’ 2026-09-06
- [x] Isolated current-source baseline: d304130
- [x] Task 1
- [x] Task 2
- [x] Task 3
- [x] Task 4

## 검증 기록

- 프론트엔드: Vitest 31개 파일·224개 테스트 통과. 이후 테스트 URL 타입 선언 수정에 영향받은 비동기 테스트 11개 재검증 통과.
- 프론트엔드 타입 검사 통과. `VITE_API_BASE_URL=http://localhost:3301 npm run build` 클라이언트·SSR·prerender 및 기존 G2B 산출물 검증 통과. 격리 작업 폴더의 공유 node_modules 캐시 경로 문제는 생성된 `.nuxt`를 재생성해 해결했고 운영 설정은 변경하지 않았다.
- 실제 UI: 데스크톱 440px 팝업, 모바일 390×844 하단 모달·포커스/스크롤 잠금·ESC 복귀, 확인 서비스 미연결 시 503 안내와 입력 유지 확인.

- 백엔드 전체 `npm run test:ci` 통과: 43개 suite·413개 테스트, 계약 4개 suite·32개 테스트, 전체 린트·타입 검사·빌드·컴파일 부트스트랩·TypeORM 검색 통과. 기본 실행에서 생략되는 실제 DB 테스트는 별도 격리 PostgreSQL에서 실행했으며 최종 첨부/관리자/HTTP/저장소 4개 suite·53개 테스트 통과.
- 독립 리뷰: 제품·메일 공통 기능 리뷰 통과. 최종 연결 리뷰에서 발견한 삭제 응답 유실 시 재시도 문제 수정 및 별도 재현 검증 완료, 남은 P0/P1/P2 없음.
- 실제 국세청·NAVER WORKS·R2 운영 연결 및 운영 DB 마이그레이션은 수행하지 않았다.

- 원래 작업 폴더 반영 완료: 검증된 기능 파일 77개가 격리 폴더와 동일함을 확인했다. 동시에 수정된 제품 문서는 양쪽 내용을 합쳤고 기존 제품/이미지/SEO 변경을 보존했다.
- 원래 작업 폴더 통합 후 프론트엔드 재검증: 32개 파일·241개 테스트, 타입 검사, 프로덕션 빌드 및 G2B 산출물 검사 통과. 실제 운영 배포는 수행하지 않았다.

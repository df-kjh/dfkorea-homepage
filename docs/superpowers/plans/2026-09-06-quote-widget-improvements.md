# 견적 위젯 확대·입력 흐름·메일 개선 계획

> **For agentic workers:** Use superpowers:subagent-driven-development for independent frontend and email tasks. Main coordinates, verifies results and updates this checklist.

**Goal:** PC 기본 확대 위젯과 명확한 사양 입력 전환, 읽기 쉬운 표 형식 견적 메일을 제공한다.
**Architecture:** 기존 익명 견적 API/DB/전송 계약은 유지하고 Vue presentation state 및 메일 renderer만 변경한다. 프론트엔드와 메일은 독립 구현 후 통합 검증한다.
**Tech Stack:** Vue/Nuxt, TypeScript, Vitest, NestJS, Jest, HTML email.
**Spec:** 이 문서의 사용자 요구사항 및 설계(2026-09-06 대화).

## 사용자 요구사항 및 설계

- 런처 위치: BackToTop 미표시 시 화면 가장 우하단(기본 여백·안전영역), 표시 시 BackToTop 바로 위. 표시 여부 판단은 기존 BackToTop과 동일한 기준을 공유한다. 모바일은 아이콘만 표시하고 aria-label 온라인 견적 유지. 열려 있는 패널도 버튼과 겹치지 않게 위치 조정한다.
- PC 헤더 X 옆에 확대/축소 버튼, 초기값 확대. 새로고침 전 사용자가 선택한 크기는 닫았다 열어도 유지한다. 개인정보 영구 저장은 추가하지 않는다.
- 화면 '면적' 2/3를 가로80vw × 세로84vh 정도로 해석한다. 실제 가용 높이/여백/런처와 겹침을 고려하고 작은 화면에서는 가용 영역을 넘지 않는다. 축소는 기존440px. 모바일639px 이하의 기존 화면/포커스 동작 유지, 크기 버튼 숨김.
- 넓은 화면에서 기업/담당자 정보를 그룹화한 두 열, 제품 검색/사양 입력 및 담은 품목을 두 열로 배치. 축소·모바일·태블릿에서 읽을 수 있는 단일 열 fallback. 제품 검색과 직접입력, 요청검토 화면도 넓은 크기에 맞춰 배치.
- 제품 더 보기: 기존 결과 DOM을 로딩/실패 시에도 유지하고 새 항목만 아래에 추가한다. 요청 중 중복 실행을 막고 현재 스크롤 위치를 유지한다. 기존 목록이 로딩 UI로 교체되어 높이가 줄어드는 회귀를 검증한다. 검색/필터가 바뀌면 이전 더 보기 응답이 섞이지 않아야 한다.
- 검색 결과의 '+ 담기'는 사양 입력 시작임을 알 수 있는 문구로 정리. 선택 직후 사양 폼을 눈에 보이게 하고 heading에 focus({preventScroll:true}), 패널 내부만 scroll. 제품 목록 끝까지 수동 스크롤할 필요가 없어야 한다.
- 사양 확정 후 품목 추가를 status로 알리고 담은 목록/다음 행동을 쉽게 찾게 한다. 취소/직접입력 진입·완료·오류도 문맥과 draft를 보존한다. reduced-motion 준수.
- 견적 메일: 접수정보, 기업·회신정보, 품목별 사양/수량, 사진 이름, 추가요청/납기를 각각 제목과 key/value table로 표시. 회신 이메일도 테이블 안에 포함. 인라인 스타일·유동폭·줄바꿈·긴 값·메일클라이언트 호환성을 고려한다.
- 모든 사용자 문자열 HTML escape 유지. 메일 제목/수신자/첨부 전송 계약 유지. 텍스트 대체본문에도 동일한 업무 정보를 포함한다.
- DB/환경변수 변경 없음. 원래 product-studio-imagery의 미배포 작업을 건드리지 않는다. 운영 main a68c5f0을 기준으로 기존 격리 작업공간에서 작업.

## Task 1: 프론트 위젯 및 제품 전환

**Files:** QuoteLauncher.vue와 BackToTop 관련 공통 가시성 로직/테스트, QuotePanel.vue/spec.ts, quote.css, CompanyStep.vue, ProductStep.vue, ProductPicker.vue/spec.ts, CatalogSpecification.vue, CustomProductForm.vue, QuoteItemList.vue, ReviewStep.vue 및 필요시 common/quote 공통 UI/helper.
**Interfaces:** 기존 useQuoteDraft API와 QuoteSubmission 동일. 편집 여부가 있으면 ProductStep.isEditing()에서 카탈로그 사양 편집도 포함해 누락 제출을 막는다. 내부 emit/ref를 통해 선택/완료 후 표시·포커스 이동을 조정한다.

- [x] BackToTop 표시/미표시와 모바일 아이콘 전용 런처 동작 검증.
- [x] 더 보기 중/후/실패의 기존 DOM 및 스크롤 보존 회귀 테스트와 stale 응답·중복 요청 검증.
- [x] 기존 관련 테스트 통과 확인; 확대 기본값/전환/모바일숨김 및 선택→사양 heading focus regression을 먼저 추가하고 실패 확인.
- [x] 확대 상태와 접근성 label/pressed, 반응형 그룹 배치 구현. 입력 중 크기 전환/닫기재열기에서 draft 보존 확인.
- [x] 제품 선택→사양 입력→담은 목록 피드백 구현. 예: select click 후 `expect(document.activeElement).toBe(specificationHeading)`, 취소 뒤 해당 제품 선택 버튼으로 focus 복귀.
- [x] 테스트/타입/빌드 검증; 모의 세션으로 local PC 확장·축소·모바일·제품사양 흐름 시각 확인에 필요한 검증 방법 보고.
- [x] docs/menus/home.md와 products.md의 구현 완료/한계/관련파일 업데이트.

## Task 2: 견적 메일

**Files:** dfkorea-backend/src/quotes/quote-mail.ts, quote-mail.spec.ts. 합성 데이터만 사용하는 로컬 HTML 미리보기 생성 도구는 필요시 scripts 아래.
**Interfaces:** renderQuoteMail(request, items, photos)의 반환값 to/fromName/subject/html/text 그대로. 첨부 bytes나 전송 transport 변경 없음.

- [x] HTML 표 내부 접수번호~회신이메일 및 사양/추가요청/납기·텍스트본문 보존, 악성/긴 입력 escape 테스트를 먼저 추가하고 실패 확인.
- [x] 재사용 row/section table renderer와 인라인 스타일, 한국시간 표시 구현. 선택/보유 인증, 상품 snapshot과 요청 사양의 의미 보존.
- [x] 대상 Jest 및 backend build/lint 검증. 실제 회사정보가 없는 catalog+custom+3photos 합성 미리보기 HTML 생성. 실제 이메일 발송 금지.

## Task 3: 통합 및 운영 반영

- [x] 두 결과 취합 및 독립 리뷰, 발견사항 수정·검증.
- [x] 실제 브라우저로 확대/축소·모바일·선택 폼 이동 및 메일 미리보기 검사. 메일은 실제 수신 클라이언트 검증과 구분.
- [x] docs/menus/quote.md와 본 체크리스트 최신화. 모든 사용자 요구사항별 결과 기록.
- [x] 변경을 커밋하고 운영에 반영, Railway/Vercel 성공 및 운영 화면/API 확인. 원본 작업공간의 미배포 코드는 보존.

## 검증 기록

- 기준 frontend 관련 테스트24개, backend mail 테스트1개 통과.
- 더 보기 원인: ProductPicker loading/error 분기가 기존 결과 DOM을 제거한다. ProductsView도 append error에서 기존 grid를 제거한다. 두 화면에서 append 로딩/실패를 분리한다.
- app.vue의 showBackTop(scrollY>300)을 런처 prop으로 공유해 표시 기준 중복을 피한다.
- 실제 메일 수신 테스트는 수행하지 않는다. 로컬 합성 API/기업/제품만 사용하는 UI QA 준비 중.

로컬 UI QA는 실제 국세청·메일·접수 호출 없이 합성 기업·제품과 루프백 API로 검증했다. 개발용 API 주소는 실행 프로세스에만 주입했다.

- PC 1440×1000: 기본 패널1152×840(화면 면적67.2%), 축소440px, 닫기·재열기와 크기 전환 시 입력 유지.
- 모바일390×844: 전체 화면 폼, 크기 버튼 숨김, 아이콘 전용 런처. 페이지 위로 버튼 미표시 시 하단24px, 표시 시84px(버튼 간12px).
- PC·모바일 모두 제품 선택 시 사양 heading이 보이고 포커스 이동. 호스트 페이지 스크롤은 유지. 직접 입력 진입·담기·2열 요청 확인까지 검증.
- 더 보기 오류: 기존16개, 스크롤1398px가 요청 전/중/오류 후 동일. 재시도 성공16→24개에서도1398px 유지. 대기 중 사용자가 위로500px 이동한 위치도 유지.
- 프론트 회귀: 기준24개 통과, 신규 실패를 확인한 뒤 수정. 전체36파일252개 통과. 별도 리뷰에서 발견한 이전 append 중 필터 변경 후 무한 스크롤 정지 문제도 회귀 실패→통과 확인. 최종 재검토 차단사항 없음.
- 메일: 신규5개 red→기존 포함6개 green, 메일+transport40개 통과, backend build/lint 통과. 1100px/390px 브라우저에서 표·줄바꿈·가로 넘침 없음 확인(실제 메일 수신 아님). 발송 계약·DB·환경변수 변경 없음.
- 로컬 Nuxt production build는 개발 출력이 남으면 공유 의존성 캐시 경로로 이동하는 환경 문제가 있어, 개발 서버 종료 후 작업공간의 생성된 .nuxt만 정리하고 재검증한다.
- 최종 프론트 타입 검사·변경 파일 ESLint·production build 통과. 22개 경로 사전 렌더링 및 G2B artifact 검사, 운영 API 주소 포함·localhost fallback 부재 검사 통과. 로컬 개발 출력 정리로 캐시 문제 해결, 소스/의존성 설정 변경 없음.

## 운영 반영 결과

- 운영 소스 커밋: `7a7d7d30889eab23cf3444611316b193bd783692` (메일 커밋 `069b937` 포함).
- Railway `58034d07-c95e-4377-8a07-86a9f83e1095`: SUCCESS. 서비스 루트 HTTP200 응답 확인.
- Vercel `dpl_HNkt6pSNfa573ykNvidArBS27Gfr`: READY, production. 실제 `https://dfkorealed.com/`에서 변경 화면 확인.
- 운영 PC1440×1000에서 기본1152×840, 축소440px 확인. 개인정보 안내 정상 로딩 확인.
- 운영 모바일390×844에서 아이콘 전용48px, 페이지 위로 버튼 없으면 하단24px, 표시 시 버튼 간12px와 하단84px 확인. 임시 브라우저 viewport 설정 복원.
- 실제 사업자 진위확인 성공·견적 메일 발송은 이번 작업에서 수행하지 않았다. 메일 렌더러/전송 회귀40개 및 합성 HTML 미리보기로 검증했다.
- 이 운영 결과 기록은 배포 후 문서 변경이며 배포 소스 커밋과 구분한다. 원래 작업공간의 소스·브랜치는 수정하지 않았다.

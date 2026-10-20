# 관리자 기능 현황

## 구현 완료

- 2026-10-20 상세 미리보기 폭 통일: 공개 상세와 같은 공통 CSS로 섹션 배경을 미리보기 영역 전체에 채우고 내부 콘텐츠만 같은 최대 너비와 여백에 정렬합니다. 너비 계산은 브라우저 화면이 아닌 상세 템플릿 컨테이너를 기준으로 하므로 PC·모바일 미리보기에도 동일하게 적용됩니다.

- 2026-10-19 설치 연출 수정본 연결(로컬 구현, 미배포): 칠판등·파이프 펜던트·가로등·차량유도등·벽부등·크린룸의 여섯 기본 이미지를 v2로 연결했습니다. 파이프는 주차장, 벽부등은 주차장 차량 램프 환경으로 대체텍스트와 설치 계획 설명을 맞췄습니다. 다른 여덟 유형의 v1과 몰드바·등록 원본 사진, 관리자가 명시한 v1 콘텐츠는 보존합니다. 공개 README/manifest는 현재 파일과 출처·해시를 기록하며 전체 생성 이력은 output에 둡니다.

- 2026-10-19 상세 주석 반영(로컬 구현, 미배포): 관리자 미리보기도 공통 템플릿의 재생 제어 버튼·제어 패널 안내 행·사양 안내 문단·h1 상단 모델 행·히어로 확대 버튼·섹션 앞 장식 선 삭제를 공유합니다. 기존 히어로 하단 제품명·모델명과 명시적 v1 제목·설명·사진·캡션 우선순위, 편집 필드와 미리보기의 이동·확대·견적 비활성화는 유지합니다.

- 2026-10-19 제품 등록·수정에 재사용 가능한 상세 템플릿 편집기를 추가했습니다. 공통 기본값 사용은 `detailContent: null`로 저장하며, 직접 편집에서는 히어로·소개·구조·제어·규격 제목, 소개 문구, 이미지 URL·업로드·대체텍스트·캡션, 특징 6개, 구조 이미지 6장, 선택적 적용 이미지, 제어·규격 표시를 설정합니다. 사양 수치는 기존 제품 필드만 사용합니다.
- 제품 상세 콘텐츠를 복사해서 불러오고 생성·수정 요청 모두 명시적으로 전송합니다. 빈 선택 항목은 저장에서 제외하고 부분 입력·안전하지 않은 이미지 주소·문자/배열 제한 위반은 저장 전에 표시합니다. 공통 이미지 삭제 버튼은 이미지와 메타데이터를 함께 비우며, 초기화는 사양과 기존 Markdown 기술 자료를 유지합니다.
- 저장 전 미리보기는 공개 `ProductDetailTemplate`을 그대로 사용합니다. PC·375px 모바일 너비를 지원하고, 견적 담기·사진 확대·페이지 이동은 비활성화합니다. 기존 인증된 `useImageUpload('products')`와 관리자 중계를 재사용합니다.
- 미리보기와 공개 상세는 기존 등록 사진의 API 기준 주소 변환을 공유합니다. `Product.images`의 루트 상대 주소는 API에서 표시하고, 직접 작성한 상세 콘텐츠의 `/images/...`는 사이트 정적 경로를 유지합니다. 표시용 복사본만 변환하므로 원 API 데이터와 저장 요청의 이미지 주소는 유지합니다.
- 2026-10-19 공통 기본값은 원 제품 25개에 같은 제목·섹션 순서와 유형별 설치 연출을 표시합니다. 직접 입력한 v1의 제목·설명·이미지·특징·빈 구조 배열·표시 여부·적용 이미지·캡션은 모두 기본값보다 우선하며 `detailContent: null`로 초기화하면 새 공통 기본값으로 돌아갑니다.
- 기본 생성 이미지 히어로는 공통 배경형 레이아웃을 사용하며 자동 사진 주석을 추가하지 않습니다. 출처 구분은 이미지 대체텍스트와 에셋 기록에 유지하며 설치 영역의 자동 안내 문구는 표시하지 않고, 히어로에는 관리자가 명시적으로 입력한 `heroImage.caption`만 표시합니다. 모바일 cover 배경은 밝은 이미지 위 본문 대비를 확보하는 전용 오버레이를 사용합니다. 직접 입력한 히어로 사진과 미분류 제품 원본은 contain 배치이며, 모바일의 긴 소개와 제품군 선택이 사진·견적 버튼과 겹치지 않도록 공간을 확보합니다.
- 실제 폼·공통 이미지 업로더·업로드 composable·상세 편집기·공개 렌더러를 조합한 16개 통합 테스트와 콘텐츠 경계 24개 테스트를 로컬 API 대체 환경에서 확인했습니다. 네트워크·라우터·Nuxt 실행 환경·외부 Markdown 위젯만 테스트 대역으로 대체했습니다.

- 2026-10-05 글꼴 통일: 공식 Pretendard v1.3.9 가변 WOFF2를 사이트에서 직접 제공하고 공통 글꼴 토큰을 적용했습니다. 메뉴·제목·본문·버튼·입력·숫자는 Pretendard를 사용하며 기존 글씨 크기·굵기·페이지 구조와 동작은 유지합니다. 아이콘 전용 글꼴과 Markdown 소스의 고정폭 글꼴은 용도에 맞게 유지합니다.

- 2026-09-07 메인 코드 `e797040`을 Vercel/Railway 운영에 반영했다. 익명 보호 API·CSRF·CORS와 공개 페이지를 포함한 운영 15개 검사를 통과했다.

- 로그인 JWT를 브라우저 JavaScript에서 읽을 수 없는 HttpOnly·Secure·SameSite=Lax 호스트 쿠키로 관리한다. 로그인 응답은 사용자명만 반환하며 기존 localStorage 토큰을 제거한다.
- SSR/브라우저 관리자 이동 시 서버 세션을 확인한다. 모든 보호 API는 JWT 서명·만료·현재 관리자 계정과 비밀번호 상태를 검증한다. 세션은 1시간이며 이전 형식 토큰은 거부한다.
- 로그인 입력 크기, 계정/원천별 시도 횟수를 제한하고 존재하지 않는 계정에도 bcrypt 비교와 동일한 실패 메시지를 사용한다.
- 관리자 중계는 고정 API·허용한 경로/메서드만 처리한다. 변경 요청의 Origin을 정확히 검사하고 본문 크기를 제한하며 쿠키/자격증명/redirect를 그대로 중계하지 않는다. JSON·multipart·견적 첨부 바이너리를 지원한다.
- 제품·소식·인증서 쓰기, 입찰 기능, 견적 관리, 스케줄러, 업로드/삭제 경로의 인증 경계를 로컬 HTTP 테스트로 검증한다. 공개 카탈로그·소식/인증 조회 및 고객 견적은 기존 공개 경계를 유지한다.
- 파일 업로드는 인증을 multipart 파싱보다 먼저 수행한다. 허용 폴더·형식·시그니처·파일 크기·40MP 픽셀 제한을 적용하고 이미지를 WebP로 재인코딩한다. PDF는 형식 검사와 첨부 다운로드를 적용한다. 삭제는 설정된 R2 공개 base와 관리 파일명만 허용한다.
- 정확한 CORS origin, 관리자 no-store/noindex, nosniff·프레임 삽입 방지와 HTTPS 응답 HSTS를 적용한다. 제품명 HTML 직접 렌더링을 제거하고 주요 보안 취약 의존성을 패치했다.

## 미구현

- MFA/패스키, 관리자별 역할 분리 및 보안 감사 이력 UI.
- 서버 세션 테이블 기반 개별 토큰 즉시 폐기와 모든 기기 로그아웃.

## 부족하거나 개선이 필요한 기능

- 비상 제어의 1000ms 지연은 미리보기와 공개 상세의 내부 데모 값이며 실제 제품 전환 시간을 보장하지 않습니다. 이번 변경은 로컬 렌더러·관리자 폼 회귀 검증 범위이고 운영 저장·이미지 업로드·배포·하드웨어 검증은 수행하지 않았습니다.

- 상세 템플릿은 이번 작업 브랜치에 구현한 상태이며 운영 배포·운영 제품 저장·운영 DB 마이그레이션·R2 업로드는 실행하지 않았습니다. 브라우저 검수의 로그인·상품 저장은 원본 25개 카탈로그를 복사한 loopback API의 메모리에만 반영합니다. 실제 서버 DTO·필터·그룹화 서비스는 사용하지만 운영 인증 서버·DB·파일 저장소를 대체하므로 운영 연동 검증을 뜻하지 않습니다.
- 상세 적용 이미지를 직접 등록하지 않으면 승인된 몰드바 이미지 또는 검토한 유형별 설치 예시를 사용합니다. 새 미분류 제품은 원본 사진과 중립적인 설치 안내로 대체하고, 사진도 없으면 안내 문구를 남깁니다. 생성 예시는 실제 시공·조도 측정 결과가 아니며 현재 v1에는 기본 적용 이미지 하나만 따로 숨기는 스위치가 없습니다. 이번 변경은 로컬 구현이며 운영 저장·업로드·배포를 하지 않았습니다.

- 로그인 제한은 프로세스 메모리 기반이다. 재시작 시 초기화되며 여러 replica 간 공유되지 않는다. BFF/프록시 원천은 함께 집계될 수 있어 공유 저장소 또는 신뢰 가능한 플랫폼 제한을 추가할 수 있다.
- 로그아웃은 쿠키를 삭제한다. 이미 탈취된 bearer는 최대 1시간 유효하므로 긴급 시 JWT_SECRET 회전 또는 관리자 자격 변경이 필요하다.
- 운영 호스팅의 요청 크기 제한에 맞춰 관리자 이미지/PDF는 4MiB로 제한한다. 더 큰 파일은 압축해야 하며, 대용량 지원은 별도 서명 업로드 기능이 필요하다. 공개 고객 견적 파일 경계는 변경하지 않는다.
- PDF 형식 검사는 악성코드 검사가 아니다. 기존 공개 R2 객체의 헤더 변경/재검사는 수행하지 않았다.
- 수집·AI 작성 같은 동기 작업은 최대 240초 중계/호스팅 300초 범위에서 처리한다. 시간 초과가 작업 취소를 뜻하지 않으므로 결과 확인 후 재시도한다. 비동기 상태 조회 방식은 후속 과제다.
- CSP는 frame-ancestors만 적용했다. script-src까지 강화하려면 Nuxt·에디터·3D 렌더링과 함께 별도 검증한다.
- 운영에서 실제 관리자 저장/파일 삭제/메일 발송을 테스트하지 않는다. 인증된 기능은 외부 저장소와 DB를 대체한 로컬 HTTP 테스트로 검증한다.

## 관련 파일

- 상세 주석 공통 적용·집중 검증: `led-lighting-website/src/components/products/detail/{ControlSimulation,DetailControl,DetailHero,ProductDetailTemplate}.vue`, `detail.css`, `output/product-detail-feedback-20261019/ui-report.md`.

- 공통 기본값·설치 매핑: `led-lighting-website/src/components/products/detail/{content.ts,application-profiles.ts}`.
- 25개 원 제품·v1 우선순위 검증: `led-lighting-website/src/components/products/detail/{content.spec.ts,ProductDetailTemplate.spec.ts,__fixtures__/catalog.json}`.
- 이번 집중 검증 기록: `output/product-detail-consistency-20261019/content-report.md`.

- 상세 편집기: `led-lighting-website/src/components/admin/product-detail/`, `src/views/admin/ProductFormView.vue`, `src/views/admin/ProductFormView.detail.spec.ts`.
- 공개 공통 템플릿: `led-lighting-website/src/components/products/detail/ProductDetailTemplate.vue`, `src/types/product-detail.ts`.
- 등록 사진 표시 주소 공통 처리: `led-lighting-website/src/utils/product-images.ts`.
- 로컬 검증 보고서·loopback 도구: `output/product-detail-template-20261019/admin-report.md`, `local-qa-api.mjs` (작업 산출물이며 배포 코드 아님).

- 공통 글꼴: `led-lighting-website/src/assets/styles/fonts.css`, `src/assets/main.css`, `tailwind.config.js`, `nuxt.config.ts`, `public/fonts/pretendard-v1.3.9/` (원본 WOFF2·출처·SIL OFL 1.1).

- `dfkorea-backend/src/auth/`, `src/upload/`, `src/security/`, `src/main.ts`
- `led-lighting-website/src/server/api/admin/`, `src/server/utils/admin-relay.ts`, `src/server/middleware/`
- `led-lighting-website/src/api/client.ts`, `src/middleware/auth.ts`, `src/views/admin/`
- `docs/security/2026-09-07-admin-hardening-report.md`, `DEPLOYMENT.md`

## 갱신 규칙

- 상세의 공통 표시를 바꾸면 공개 화면과 미리보기의 일치, v1 명시적 입력 보존 및 이동·확대·견적 차단을 함께 확인합니다. 내부 데모의 시간 값을 제품 성능으로 설명하지 않습니다.

- 제품 상세 콘텐츠 계약·편집 필드·미리보기·저장·업로드 방식이 바뀌면 이 문서와 `docs/menus/products.md`를 함께 갱신하고 기존 사양·Markdown 보존, 생성/수정/초기화 및 공개 렌더러 미리보기를 검증합니다.

- 공통 글꼴 변경 시 전역 토큰·Tailwind·견적 Teleport 루트와 공식 에셋/라이선스를 함께 관리하고 데스크톱·모바일의 실제 글꼴 로딩과 줄바꿈을 확인합니다.

- 관리자 경로, 쿠키, 만료, 권한 또는 저장소 경계가 변경되면 이 문서와 관련 메뉴 문서를 같이 갱신한다.
- 기능의 테스트 근거와 운영 미검증 범위, 인증/제한 정책의 남은 한계를 함께 기록한다.

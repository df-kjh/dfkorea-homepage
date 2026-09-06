# 홈 메뉴 기능 현황

## 구현 완료

- 대표 도메인을 `https://dfkorealed.com`으로 통일했다. 홈의 canonical URL은 `https://dfkorealed.com`이며, 서버 렌더링 HTML에 고유 제목·설명, `index, follow`, Open Graph·Twitter URL과 canonical 링크를 포함한다.
- 홈 메타데이터는 Nuxt 페이지가 단독 관리하며, 화면의 클라이언트 로딩이 canonical·Open Graph·Twitter URL을 쿼리·해시 또는 다른 접속 호스트로 덮어쓰지 않는다.
- 홈 URL은 백엔드 동적 사이트맵의 정적 URL로 제공된다. `robots.txt`는 같은 도메인의 `/sitemap.xml`을 안내하며, Vercel은 이 요청을 백엔드 사이트맵으로 전달한다.
- 제품·소식 목록 카드에는 검색로봇과 키보드가 따라갈 수 있는 상세 URL 앵커가 제공된다. 관리자 경로(`/admin/**`)와 개발용 `/tailwind-test`는 `noindex, nofollow` 헤더와 robots 규칙으로 수집 대상에서 제외한다.

- 2026-09-06 견적 위젯 후속 개선을 `7a7d7d3`으로 운영 반영했다. Railway SUCCESS·Vercel READY 및 실제 홈페이지의 PC 기본 확대/축소, 모바일 아이콘 전용 런처와 페이지 위로 버튼에 따른 위치를 확인했다.

- 2026-09-06 온라인 견적 관련 변경을 운영 배포하고 실제 도메인에서 확인했다. 홈의 PC·모바일 견적 창과 제품명/소비전력 필터를 검증했다.

- 공개 페이지 우하단에서 항상 보이는 `온라인 견적` 버튼과 홈 상담 문의 선택의 온라인 견적 버튼이 같은 3단계 견적 창을 연다. 맨 위로 버튼이 없으면 화면 우하단 기본 여백에, 나타나면 해당 버튼 위 12px 간격으로 배치하고 관리자 페이지에서는 숨긴다. 모바일은 접근 가능한 이름을 유지한 아이콘 버튼을 사용한다.
- 견적 창은 PC에서 기본 80vw × 84dvh의 비모달 확대 창으로 표시하되 런처 위 가용 높이에 맞춰 제한한다. 헤더에서 440px로 축소할 수 있으며 창을 닫았다 열어도 선택 크기와 작성 내용을 유지한다. 실제 패널 너비가 760px 이상이면 기업/담당자, 제품 검색/사양·담은 목록, 직접입력, 요청 검토를 두 열로 배치한다. 모바일은 기존 하단 대화상자와 본문 스크롤, ESC·포커스 복귀·모바일 포커스 제한·동작 줄이기를 유지한다.
- 기업 확인·제품 및 사진 선택·접수 확인·접수번호 성공 화면을 제공하고 실패 시 입력을 보존한다. 상세 흐름은 [온라인 견적 기능 현황](quote.md)에 기록한다.

- HeroSection을 왼쪽 카피·CTA와 오른쪽 Three.js LED 전구 오브젝트의 2열 구성으로 표시한다.
- 640px 미만 모바일에서는 Hero 높이를 `max(820px, 100svh)`로 유지하고 전용 레이아웃 레이어와 동일한 상하 패딩으로 카피와 CTA의 중심을 화면 정중앙에 배치한다. 3D 전구는 포인터 입력이 없는 32% 불투명도의 배경 레이어로 겹쳐 가장자리 페이드와 텍스트 그림자로 가독성을 유지한다.
- 웹과 모바일 모두 Hero 하단에 마스킹된 블러와 다단계 그라데이션을 적용해 어두운 장면이 다음 흰색 통계 섹션으로 자연스럽게 전환된다.
- 오른쪽 장면은 상단 가로 고정 구조 없이 화면 꼭대기에서 내려오는 단일 세로 전선과 LED 필라멘트 전구로 구성한다.
- 전구는 LatheGeometry 기반 이중 고투과 유리구, 곡면 반사 하이라이트, 내부 발광 볼륨, 홈이 분리된 브라스 소켓, 세라믹 칼라, 유리 스템, 여섯 개의 곡선형 전구색 필라멘트와 지지 링·와이어를 계층적으로 모델링한다.
- 전선은 단일 원통 메시와 120Hz 고정 스텝의 감쇠 진자로 표현하며, 다관절 파동을 생성하지 않는다.
- 마우스가 전선을 스치면 수평 이동량만 제한된 각속도로 전달하고, 작은 접촉도 11~13도까지 반응하면서 극단적인 입력은 좌우 18도 안에서 부드럽게 감쇠한다.
- 데스크톱 전구는 꺼지지 않는 35~82% 범위에서 여러 주기의 파형을 합성해 불규칙하게 밝기가 변하며, 전구에 마우스를 올리면 필라멘트와 PointLight가 함께 최대 광량으로 전환된다.
- 모바일 전구는 12초 주기 안에서 간격과 길이가 다른 다섯 소등 구간을 반복하며, 소등 시 필라멘트·PointLight·내부 발광·광륜을 모두 0까지 낮춘다. CSS 폴백도 같은 주기의 점등 패턴을 사용한다.
- 절차적으로 생성한 스튜디오 환경 반사, ACES 톤매핑, 확장된 도달 거리의 2700K 계열 PointLight, 필라멘트 외곽 발광층과 강화된 이중 전구색 광륜으로 유리 반사와 따뜻한 내부 발광을 표현한다.
- 화면 크기에 따라 픽셀 비율과 전구 방사형 세그먼트를 모바일 64, 데스크톱 96으로 제한하고, 화면 밖에서는 애니메이션을 일시정지한다.
- `prefers-reduced-motion` 환경에서는 줄 물리와 자동 밝기 변화를 정지하고 고정 밝기로 한 프레임만 렌더링하며, 전구 호버 밝기만 유지한다.
- WebGL 초기화, 렌더 프레임 또는 컨텍스트 실패 시 GPU 리소스와 이벤트를 즉시 정리하고 동일한 구도의 CSS 정적 폴백을 표시한다.
- 제품 보기, 회사 소개 CTA와 Hero의 실제 하단으로 이동하는 스크롤 컨트롤을 제공한다.

## 미구현

- 실제 자사 LED 전구 제품의 CAD/GLB 형상과 정확한 치수는 적용하지 않았다.
- 실제 제품별 색온도, 배광 데이터와 광도 분포 시뮬레이션은 적용하지 않았다.

## 부족하거나 개선이 필요한 기능

- 2026-09-06 Google Search Console(`kymkjh2002@gmail.com`)과 네이버 서치어드바이저에서 `https://dfkorealed.com` 소유권 및 사이트맵 등록을 확인했다. Google은 사이트맵 상태 `성공`, 발견된 페이지 145개로 갱신되었다. 긴급 반영이 필요한 URL만 각 도구에서 별도로 재수집을 요청한다.
- 매월 Search Console과 서치어드바이저에서 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 검색 결과 노출이나 순위를 보장하지 않으므로 제목·본문·내부 링크 품질도 함께 관리한다.

- 확대·축소, 사양 입력 전환, 추가 로딩과 런처 위치 개선은 회귀 테스트·타입 검사와 로컬 PC·모바일 브라우저 검수를 통과했다. 운영 반영 여부는 별도 확인한다. 메모리 내 작성 상태만 유지하며 새로고침 후 개인정보를 복원하지 않는다.

- 견적 UI와 실제 API 연결 코드는 구현했지만 국세청 운영 상호 검증, NAVER WORKS 실제 수신, 사진 임시 보관·운영 보유기간 확인 전에는 외부 운영 연동 완료로 표시하지 않는다. 연결 불가 시 재시도와 기존 전화·이메일 문의를 안내한다.

- 현재 전구는 브랜드 인상을 위한 추상화 모델이므로 실제 제품 외형과 내부 기판 구조가 다를 수 있다.
- 전선 물리는 과도한 파동을 방지하기 위한 2차원 단일 진자 방식이므로 깊이 방향의 회전, 전선 휨, 복잡한 충돌은 지원하지 않는다.
- 실제 제품 모델이 제공되면 현재 물리·밝기·렌더러 생명주기를 유지한 채 전구 메시와 재질만 교체해야 한다.
- 저사양 기기별 실제 프레임 시간 데이터가 축적되면 픽셀 비율과 관절 수 기준을 추가 조정할 수 있다.

## 관련 파일

- `led-lighting-website/src/views/HomeView.vue`
- `led-lighting-website/src/views/list-indexing.spec.ts`
- `led-lighting-website/src/app.vue`
- `led-lighting-website/src/pages/index.vue`
- `led-lighting-website/nuxt.config.ts`
- `led-lighting-website/vercel.json`
- `led-lighting-website/public/robots.txt`
- `dfkorea-backend/src/seo/seo.controller.ts`
- `dfkorea-backend/src/seo/seo.module.ts`
- `led-lighting-website/src/components/home/CtaSection.vue`
- `led-lighting-website/src/components/quote/QuoteLauncher.vue`
- `led-lighting-website/src/components/quote/QuotePanel.vue`
- `led-lighting-website/src/components/quote/quote.css`
- `led-lighting-website/src/components/quote/QuoteLauncher.spec.ts`
- `led-lighting-website/src/components/quote/QuotePanel.spec.ts`
- `led-lighting-website/src/composables/useQuoteDraft.ts`
- `docs/menus/quote.md`

- `led-lighting-website/src/components/home/HeroSection.vue`
- `led-lighting-website/src/components/home/HeroSection.spec.ts`
- `led-lighting-website/src/components/home/HangingBulbScene.vue`
- `led-lighting-website/src/components/home/HangingBulbScene.spec.ts`
- `led-lighting-website/src/components/home/hanging-bulb/createHangingBulbController.ts`
- `led-lighting-website/src/components/home/hanging-bulb/createHangingBulbController.spec.ts`
- `led-lighting-website/src/components/home/hanging-bulb/hangingBulbPhysics.ts`
- `led-lighting-website/src/components/home/hanging-bulb/hangingBulbPhysics.spec.ts`

## 갱신 규칙

- 대표 도메인, 홈의 제목·설명·canonical, robots 정책, 사이트맵 또는 공개 목록 상세 링크가 바뀌면 영향을 받는 제품·소식·인증 메뉴 문서와 함께 갱신한다.
- 월간 색인 점검에서 오류나 제외 사유가 확인되면 원인, 조치, 재검증 결과를 이 문서와 관련 메뉴 문서에 기록한다.

- 홈 상담 문의 진입점과 공개 전역 견적 창의 동작·반응형·접수 상태가 바뀌면 온라인 견적 문서와 함께 갱신한다.

- 홈 Hero의 레이아웃, 카피, 3D 전구 모델, 줄 물리, 밝기 상호작용, 품질 정책 또는 fallback 방식이 변경되면 이 문서를 같은 작업에서 갱신한다.
- 실제 제품 모델이나 측광 데이터를 적용할 때는 구현 완료와 한계 항목을 함께 수정한다.

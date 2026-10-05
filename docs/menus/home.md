# 홈 메뉴 기능 현황

## 구현 완료

- 2026-10-05 가독성 조정: Noto Sans KR 본문 16–17px, 보조 정보 13–14px, 메뉴·버튼 15–16px와 600 굵기의 공통 기준을 적용했습니다. Hero의 제목 크기·셰이더·마우스 반응과 파트너 캐러셀 동작은 유지하고, 본문·안내·하단 메뉴를 보강했습니다.
- 제품 캐러셀이 공유하는 제품 카드의 제품명·모델명·사양·인증 정보도 같은 가독성 기준과 장문 줄바꿈을 적용했습니다.

- 2026-10-05 파트너 캐러셀: 기존 여덟 곳에 삼성바이오로직스·앰코코리아·LH 한국토지주택공사 공식 로고를 추가했다. 이전 CSS 무한 스크롤 방식을 현재 디자인에 맞춰 복원해 11개 로고를 44초 주기로 끊김 없이 순환한다. 마우스 올리기와 일시정지/재생 제어를 제공하며 반복 복제본은 보조기술에서 숨긴다. 동작 줄이기 설정에서는 모든 로고를 정적인 여러 줄 목록으로 표시한다.

- 2026-10-05 추가 주석 반영: 공통 헤더의 로고 영역 배경을 투명하게 변경했다. 어두운 Hero에서는 흰색 로고를 유지하고 밝은 헤더에서는 CSS로 로고 글자를 어둡게 표시한다. 이미지·메뉴 경로·헤더 높이는 유지한다.

- 2026-10-05 추가 주석 반영: Hero 제품 보기·회사 소개 버튼과 홈 상담 문의하기 버튼만 텍스트를 중앙 정렬했다. 상담 문의하기의 화살표를 제거했으며 버튼 크기·클릭 이벤트·상담 선택창·Hero 효과는 유지한다.

- 2026-10-05 주석 반영: 공통 헤더에 첨부한 회사 로고의 배경 제거·흰색 PNG를 적용했다. 밝은 헤더에는 로고 영역만 어두운 바탕을 두며 홈 링크·회사소개/제품/인증/소식 경로와 모바일 메뉴를 유지한다. 공통 푸터의 상단 문의 문구·전화·메일 영역을 제거하고 하단 메뉴·회사 주소·FAX·저작권은 유지한다.
- 2026-10-05 홈 주석 반영: Hero의 제품 보기·회사 소개 버튼 화살표와 하단 상담 옆 안내 문구를 제거했다. 통계는 리디자인 전 `회사 설립 10+ / 다양한 제품군 30+ / 인증 50+ / 설치 현장 300+`를 그대로 복원하고 기존 디자인·SSR 기본 표시를 유지한다. 상담 버튼과 기존 선택창·온라인 견적 진입은 유지한다.

- 2026-10-04 통합: 별도 `codex/liquid-light-site` 브랜치의 `e106a16`을 로컬 `main`에 병합했고 병합 후 소스 491개를 재검증했다. 기존 미커밋 시안 기록은 보존하며 원격 push·운영 배포는 하지 않았다.

- 2026-10-04 최종 통합 검수: 소스 Vitest 64개 파일/491개, Nuxt 타입 검사, 운영 API를 지정한 빌드와 SEO/상세 앵커 검증을 통과했다. 실제 Chrome에서 기존 네 메뉴와 상세 경로·320px 가로 넘침·Hero/원본 자료를 확인했다. 로컬 검수 증거는 `output/site-redesign-20261004/README.md`를 따른다. 운영 배포와 실제 견적 접수는 수행하지 않았다.

### 2026-10-04 실제 Nuxt 홈 Liquid Light 리디자인

- 실제 `/`의 `HomeView.vue`와 기존 홈 섹션 순서를 유지하면서 선택한 Liquid Light Hero를 Vue 컴포넌트와 타입 있는 소스 엔진으로 연결했다. 중앙 제목 `빛의 새로운 흐름.`과 앰버·샴페인 실크 흐름, 누르지 않은 마우스 이동의 국소 굽힘·밝기, 네 개 이하의 짧은 잔광과 빈 배경 클릭 파동을 단일 WebGL2 canvas/RAF로 처리한다. 제품 보기와 회사 소개는 각각 실제 `/products`와 `/about`으로 이동하며 다음 섹션 스크롤·`scrollDown` 이벤트를 유지한다.
- 수동 정지는 시간·포인터·파동을 함께 동결한다. 동작 줄이기에서는 정적인 셰이더와 비활성 제어, WebGL 실패에서는 CSS 빛 대체 화면과 사실에 맞는 안내를 제공한다. hidden/offscreen·BFCache·컨텍스트 복구·SPA unmount에 대응하며 픽셀 비율과 렌더 픽셀을 제한한다. 라우트 이탈 시 GPU/RAF/이벤트/observer와 문서 진단값을 정리하고, 이전 인스턴스의 정리가 새 Hero 진단값을 지우지 않도록 소유권을 구분한다. native cursor와 수동 터치 스크롤을 유지한다.
- 설립 `2013`과 LED 제조·제품 선택·상담 설명으로 확인되지 않은 설치·인증·제품 수를 대체했다. 기존 협력사 여덟 곳과 원본 로고, 여섯 개 공간 참고 이미지를 유지한다. 이미지가 자사 시공 사례라는 주장을 추가하지 않으며 콘텐츠는 observer나 애니메이션 없이 기본 표시된다. Feature의 제품 살펴보기 버튼은 실제 제품 페이지로 이동한다.
- 주요 제품은 기존 `productsAPI.getFeatured()`의 실제 데이터를 사용하고 공통 제품 카드의 상세 이동과 가로 스크롤을 유지한다. 초기/리사이즈 후 좌우 이동 가능 여부를 반영하고 동작 줄이기에서는 즉시 스크롤한다. 조회 중·실제 빈 결과·조회 실패를 구분하며 실패에는 재시도와 전체 제품 링크를 제공한다. 화면을 떠난 뒤 도착한 응답이나 실패 알림은 게시하지 않는다.
- 상담 선택은 native dialog의 키보드 포커스·Escape·배경 닫기를 사용하고 기존 온라인 견적 controller와 데스크톱 연락처 복사/알림·모바일 Gmail/전화 이동을 연결한다. 선택창을 닫은 뒤 견적 창이 보이는 상담 CTA를 포커스 복귀 대상으로 캡처한다. 홈 이메일은 실제 footer와 같은 `kjukym@dfkorealed.com`, 전화는 `032-528-2953`이다. 기존 `pages/index.vue`의 SEO/canonical과 전역 견적·알림·맨 위로 흐름을 유지한다.
- 집중 Vitest 검사 6개 파일·25개와 Nuxt 타입 검사를 통과했다. 누르지 않은 hover, 수치/좌표 제한, 정지·leave·reduced·실패·cleanup, 중첩 라우트 진단 소유권, Hero mount/unmount·CTA·스크롤 이벤트, 제품 실패/재시도·늦은 알림 차단, 연락처 dialog·견적 진입·스크롤 불필요 상태를 검사한다. 실제 로컬 Nuxt 브라우저에서는 hydration 이후 Hero `ready`/`playing`·프레임 증가와 API 주요 제품 네 개 표시를 확인했다. 모의 WebGL 검사와 실제 GPU 관측을 구분하며 전체 페이지/모바일 검수는 최종 통합 기록을 따른다. 이 기록은 소스 통합이며 배포 완료를 의미하지 않는다.

- 2026-09-07 Hero의 전구 모델을 4000K 중성백색 A형 LED 전구로 교체했다. 배포 전 프론트엔드 전체 44개 테스트 파일·294개 테스트를 통과했다.
- 관련 회귀 테스트 21개, 타입·린트 검사와 프로덕션 빌드를 통과했다. 1440×1000 PC 및 390×844 모바일에서 WebGL 렌더링·호버 발광·가로 넘침을 확인하고 실제 컨텍스트 손실 시 CSS 폴백 전환을 검증했다. 빌드 검증 시 9월 3일의 오래된 `.vercel/output`을 잠시 분리해 새 `.output`을 검사한 뒤 원위치로 복원했다.

- 대표 도메인을 `https://dfkorealed.com`으로 통일했다. 홈의 canonical URL은 `https://dfkorealed.com`이며, 서버 렌더링 HTML에 고유 제목·설명, `index, follow`, Open Graph·Twitter URL과 canonical 링크를 포함한다.
- 홈 메타데이터는 Nuxt 페이지가 단독 관리하며, 화면의 클라이언트 로딩이 canonical·Open Graph·Twitter URL을 쿼리·해시 또는 다른 접속 호스트로 덮어쓰지 않는다.
- 홈 URL은 백엔드 동적 사이트맵의 정적 URL로 제공된다. `robots.txt`는 같은 도메인의 `/sitemap.xml`을 안내하며, Vercel은 이 요청을 백엔드 사이트맵으로 전달한다.
- 제품·소식 목록 카드에는 검색로봇과 키보드가 따라갈 수 있는 상세 URL 앵커가 제공된다. 관리자 경로(`/admin/**`)와 개발용 `/tailwind-test`는 `noindex, nofollow` 헤더와 robots 규칙으로 수집 대상에서 제외한다.

- 2026-09-06 견적 위젯 후속 개선을 `7a7d7d3`으로 운영 반영했다. Railway SUCCESS·Vercel READY 및 실제 홈페이지의 PC 기본 확대/축소, 모바일 아이콘 전용 런처와 페이지 위로 버튼에 따른 위치를 확인했다.

- 2026-09-06 온라인 견적 관련 변경을 운영 배포하고 실제 도메인에서 확인했다. 홈의 PC·모바일 견적 창과 제품명/소비전력 필터를 검증했다.

- 공개 페이지 우하단에서 항상 보이는 `온라인 견적` 버튼과 홈 상담 문의 선택의 온라인 견적 버튼이 같은 3단계 견적 창을 연다. 맨 위로 버튼이 없으면 화면 우하단 기본 여백에, 나타나면 해당 버튼 위 12px 간격으로 배치하고 관리자 페이지에서는 숨긴다. 모바일은 접근 가능한 이름을 유지한 아이콘 버튼을 사용한다.
- 견적 창은 PC에서 기본 80vw × 84dvh의 비모달 확대 창으로 표시하되 런처 위 가용 높이에 맞춰 제한한다. 헤더에서 440px로 축소할 수 있으며 창을 닫았다 열어도 선택 크기와 작성 내용을 유지한다. 실제 패널 너비가 760px 이상이면 기업/담당자, 제품 검색/사양·담은 목록, 직접입력, 요청 검토를 두 열로 배치한다. 모바일은 기존 하단 대화상자와 본문 스크롤, ESC·포커스 복귀·모바일 포커스 제한·동작 줄이기를 유지한다.
- 기업 확인·제품 및 사진 선택·접수 확인·접수번호 성공 화면을 제공하고 실패 시 입력을 보존한다. 상세 흐름은 [온라인 견적 기능 현황](quote.md)에 기록한다.

#### 이전 A형 전구 Hero (2026-10-04 Liquid Light로 교체, 소스 보존)

- 아래 항목은 교체 전 Hero 구현과 검수 기록이다. 현재 홈은 위의 Liquid Light 소스 엔진을 사용하며 기존 전구 컴포넌트·검사는 보존한다.
- 이전 HeroSection을 왼쪽 카피·CTA와 오른쪽 Three.js LED 전구 오브젝트의 2열 구성으로 표시했다.
- 640px 미만 모바일에서는 Hero 높이를 `max(820px, 100svh)`로 유지하고 전용 레이아웃 레이어와 동일한 상하 패딩으로 카피와 CTA의 중심을 화면 정중앙에 배치한다. 3D 전구는 포인터 입력이 없는 32% 불투명도의 배경 레이어로 겹쳐 가장자리 페이드와 텍스트 그림자로 가독성을 유지한다.
- 웹과 모바일 모두 Hero 하단에 마스킹된 블러와 다단계 그라데이션을 적용해 어두운 장면이 다음 흰색 통계 섹션으로 자연스럽게 전환된다.
- 오른쪽 장면은 상단 가로 고정 구조 없이 화면 꼭대기에서 내려오는 단일 세로 전선과 불투명 확산 커버를 가진 LED 전구로 구성한다.
- 전구 형상은 전용 `createLedBulbModel.ts`에서 생성한다. LatheGeometry 기반 우윳빛 확산 돔과 곡면 방열 몸체, 얕은 몰딩 리브, 확산 커버 접합선·고정 립, 은색 연속 나선 나사산, 검은색 절연 링·케이블 홀더, DF KOREA / LED 4000 K 인쇄를 계층적으로 모델링한다. 인쇄는 장식용이며 실제 인증·정격 정보를 의미하지 않는다.
- 전선은 단일 원통 메시와 120Hz 고정 스텝의 감쇠 진자로 표현하며, 다관절 파동을 생성하지 않는다.
- 마우스가 전선을 스치면 수평 이동량만 제한된 각속도로 전달하고, 작은 접촉도 11~13도까지 반응하면서 극단적인 입력은 좌우 18도 안에서 부드럽게 감쇠한다.
- 데스크톱 전구는 꺼지지 않는 35~82% 범위에서 여러 주기의 파형을 합성해 불규칙하게 밝기가 변하며, 전구 확산 돔에 마우스를 올리면 확산 돔의 발광과 PointLight가 함께 최대 광량으로 전환된다.
- 모바일 전구는 12초 주기 안에서 간격과 길이가 다른 다섯 소등 구간을 반복하며, 소등 시 확산 돔의 발광·PointLight·광륜을 모두 0까지 낮추고 불투명 몸체와 돔의 실루엣은 유지한다. CSS 폴백도 같은 주기로 발광 레이어만 점멸한다.
- 절차적으로 생성한 스튜디오 환경 반사와 ACES 톤매핑으로 금속과 무광 폴리머 재질을 구분한다. 확산 돔·PointLight·이중 광륜에 동일한 4000K 시각 근사 색상을 사용하며 광륜은 전구 뒤에 배치해 표면과 인쇄를 가리지 않는다. 정확한 분광·측광 시뮬레이션은 아니다.
- 화면 크기에 따라 픽셀 비율과 전구 방사형 세그먼트를 모바일 64, 데스크톱 96으로 제한하고, 화면 밖에서는 애니메이션을 일시정지한다.
- `prefers-reduced-motion` 환경에서는 줄 물리와 자동 밝기 변화를 정지하고 고정 밝기로 한 프레임만 렌더링하며, 전구 호버 밝기만 유지한다.
- WebGL 초기화, 렌더 프레임 또는 컨텍스트 실패 시 GPU 리소스와 이벤트를 즉시 정리하고 동일한 LED 전구 구도의 CSS 폴백을 표시한다. 공유 지오메트리·재질·텍스처는 중복 해제하지 않으며 인쇄 텍스처도 정리한다.
- 제품 보기, 회사 소개 CTA와 Hero의 실제 하단으로 이동하는 스크롤 컨트롤을 제공한다.

## 미구현

- 실제 자사 LED 전구 제품의 CAD/GLB 형상과 정확한 치수는 적용하지 않았다.
- 실제 제품별 색온도, 배광 데이터와 광도 분포 시뮬레이션은 적용하지 않았다.

## 부족하거나 개선이 필요한 기능

- 파트너 로고는 `public/images/clients`의 정적 파일이다. 업체 목록 변경 시 ClientsSection과 에셋 출처 README를 함께 갱신한다. 신규 업체는 사용자가 지정한 파트너로 표시하며 API나 관리 화면을 추가하지 않는다.

- 현재 Nuxt Liquid Light는 화면 아트이며 실제 광학·RGB·센서·추가 색온도 기능을 의미하지 않는다. 참고한 Matthias Hurrle (@atzedent)의 noise/domain-warp 표기를 타입 있는 셰이더에 유지했으며 첨부에 라이선스가 명시되지 않아 CC0 또는 상업 라이선스 확인 완료로 표시하지 않는다. 실제 OS 설정 변경·GPU 오류 유발·BFCache hit·물리 터치 기기·FPS/광학 측정은 자동화된 생명주기 분기 검사와 별개다. 별도 프로토타입의 이전 브라우저 결과를 현재 Nuxt 검수로 대체하지 않는다.

- 2026-09-06 Google Search Console(`kymkjh2002@gmail.com`)과 네이버 서치어드바이저에서 `https://dfkorealed.com` 소유권 및 사이트맵 등록을 확인했다. Google은 사이트맵 상태 `성공`, 발견된 페이지 145개로 갱신되었다. 긴급 반영이 필요한 URL만 각 도구에서 별도로 재수집을 요청한다.
- 매월 Search Console과 서치어드바이저에서 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 검색 결과 노출이나 순위를 보장하지 않으므로 제목·본문·내부 링크 품질도 함께 관리한다.

- 확대·축소, 사양 입력 전환, 추가 로딩과 런처 위치 개선은 회귀 테스트·타입 검사와 로컬 PC·모바일 브라우저 검수를 통과했다. 운영 반영 여부는 별도 확인한다. 메모리 내 작성 상태만 유지하며 새로고침 후 개인정보를 복원하지 않는다.

- 견적 UI와 실제 API 연결 코드는 구현했지만 국세청 운영 상호 검증, NAVER WORKS 실제 수신, 사진 임시 보관·운영 보유기간 확인 전에는 외부 운영 연동 완료로 표시하지 않는다. 연결 불가 시 재시도와 기존 전화·이메일 문의를 안내한다.

- 보존된 이전 전구는 일반적인 A형 LED 전구를 참고한 브랜드용 절차 모델이다. 자사 제품 CAD·정확한 치수·내부 기판을 복제한 것은 아니며 4000K 표현은 화면과 톤매핑에 따른 시각적 근사다.
- 전선 물리는 과도한 파동을 방지하기 위한 2차원 단일 진자 방식이므로 깊이 방향의 회전, 전선 휨, 복잡한 충돌은 지원하지 않는다.
- 실제 제품 모델이 제공되면 현재 물리·밝기·렌더러 생명주기를 유지한 채 전구 메시와 재질만 교체해야 한다.
- 저사양 기기별 실제 프레임 시간 데이터가 축적되면 픽셀 비율과 메시 세그먼트 기준을 추가 조정할 수 있다.

## 관련 파일

- 공통 가독성 기준: `led-lighting-website/src/assets/styles/public-site.css`, `src/components/layout/TheNavigation.vue`, `src/components/layout/TheFooter.vue`.

- `led-lighting-website/src/components/home/ClientsSection.vue`, `ClientsSection.spec.ts`: 파트너 로고 순환과 일시정지/재생, 이미지 실패 대체, 복제 목록 접근성 검증.
- `led-lighting-website/public/images/clients/{samsung-biologics,amkor-korea}.svg`, `lh.png`, `README.md`: 신규 원본 로고와 공식 출처·표시 범위 기록.

- `led-lighting-website/public/branding/df-korea-logo-white.png`
- `output/logo-comments-20261005/README.md`

- `led-lighting-website/src/views/HomeView.vue`
- `led-lighting-website/src/components/home/{HeroSection,StatsSection,ClientsSection,FeatureSection,ProductCarousel,CtaSection}.vue`
- `led-lighting-website/src/components/home/{HeroSection,ProductCarousel,CtaSection,HomeView-flow}.spec.ts`
- `led-lighting-website/src/components/home/liquid-light/{light-field,pointer-field,light-shader}.ts`
- `led-lighting-website/src/components/home/liquid-light/{light-field.spec.js,pointer-field.spec.ts}`
- `led-lighting-website/src/components/common/site/{PublicAction,PublicPageHeader}.vue`
- `led-lighting-website/src/assets/styles/public-site.css`
- `docs/superpowers/specs/2026-10-04-liquid-light-site-redesign-design.md`
- `docs/superpowers/plans/2026-10-04-liquid-light-site-redesign.md`

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
- `led-lighting-website/src/components/home/hanging-bulb/createLedBulbModel.ts`
- `led-lighting-website/src/components/home/hanging-bulb/createHangingBulbController.ts`
- `led-lighting-website/src/components/home/hanging-bulb/createHangingBulbController.spec.ts`
- `led-lighting-website/src/components/home/hanging-bulb/hangingBulbPhysics.ts`
- `led-lighting-website/src/components/home/hanging-bulb/hangingBulbPhysics.spec.ts`

## 갱신 규칙

- 공통 글꼴 기준 변경 시 모바일 320/390/545px와 데스크톱에서 메뉴·CTA·하단 정보의 줄바꿈 및 가로 넘침을 확인하고 영향을 받는 공개 메뉴 문서를 함께 갱신합니다.

- 실제 Nuxt 홈의 Hero/포인터·정지·정적 대체·SPA 정리, 홈 섹션·사실성·실제 제품 API 상태·상담 진입·연락처를 바꾸면 이 문서의 다섯 영역을 같은 작업에서 갱신한다. 공개 공통 셸 변경은 관련 메뉴 문서, 견적 동작 변경은 온라인 견적 문서를 함께 갱신한다. 운영 소스 적용·로컬 검수·배포와 독립 프로토타입 기록을 구분한다.

- 대표 도메인, 홈의 제목·설명·canonical, robots 정책, 사이트맵 또는 공개 목록 상세 링크가 바뀌면 영향을 받는 제품·소식·인증 메뉴 문서와 함께 갱신한다.
- 월간 색인 점검에서 오류나 제외 사유가 확인되면 원인, 조치, 재검증 결과를 이 문서와 관련 메뉴 문서에 기록한다.

- 홈 상담 문의 진입점과 공개 전역 견적 창의 동작·반응형·접수 상태가 바뀌면 온라인 견적 문서와 함께 갱신한다.

- 홈 Hero의 레이아웃, 카피, 3D 전구 모델, 줄 물리, 밝기 상호작용, 품질 정책 또는 fallback 방식이 변경되면 이 문서를 같은 작업에서 갱신한다.
- 실제 제품 모델이나 측광 데이터를 적용할 때는 구현 완료와 한계 항목을 함께 수정한다.

# 회사 소개 메뉴 기능 현황

## 구현 완료

- 2026-10-05 주석 반영: 공통 헤더에 첨부한 회사 로고의 배경 제거·흰색 PNG를 적용했다. 밝은 헤더에는 로고 영역만 어두운 바탕을 두며 홈 링크·회사소개/제품/인증/소식 경로와 모바일 메뉴를 유지한다. 공통 푸터의 상단 문의 문구·전화·메일 영역을 제거하고 하단 메뉴·회사 주소·FAX·저작권은 유지한다.

- 2026-10-04 통합: 별도 `codex/liquid-light-site` 브랜치의 `e106a16`을 로컬 `main`에 병합했고 병합 후 소스 491개를 재검증했다. 기존 미커밋 시안 기록은 보존하며 원격 push·운영 배포는 하지 않았다.

- 2026-10-04 최종 통합 검수: 소스 Vitest 64개 파일/491개, Nuxt 타입 검사, 운영 API를 지정한 빌드와 SEO/상세 앵커 검증을 통과했다. 실제 Chrome에서 기존 네 메뉴와 상세 경로·320px 가로 넘침·Hero/원본 자료를 확인했다. 로컬 검수 증거는 `output/site-redesign-20261004/README.md`를 따른다. 운영 배포와 실제 견적 접수는 수행하지 않았다.

- 실제 Chrome 검수: 320px 공개 홈·회사 소개·제품·인증·소식의 clientWidth/scrollWidth가 모두 310/310으로 일치해 페이지 가로 넘침이 없었다. 공개 페이지에서만 기존 body 최소 너비를 해제했으며 관리자 전역 CSS는 보존했다. 390px 모바일 메뉴의 네 실제 경로, ESC 뒤 토글 포커스 복귀, 제품 경로 이동 뒤 닫힘을 확인했다. 증거: `output/site-redesign-20261004/{about,products,certificates,blog}-320.jpg`.
- 최종 소스 검증: `npm run type-check`가 통과했고 공통 UI·인증 집중 테스트 18개가 통과했다.

- 2026-10-04 실제 Nuxt 공개 사이트 Liquid Light 적용: `/about`을 독립 회사 소개 페이지로 유지하고, 공통 80px 헤더·실제 메뉴(`/about`, `/products`, `/certificates`, `/blog`)·footer와 ink/champagne/paper 디자인을 적용했다. 현재 메뉴는 하위 상세 경로에서도 표시하며 모바일 메뉴의 ESC 닫기·포커스 복귀·경로 이동 닫기·데스크톱 전환 초기화를 제공한다. 홈의 빛 히어로가 보일 때만 헤더를 어두운 톤으로 표시한다. 관리자 팔레트·기존 API·페이지 SEO 래퍼는 변경하지 않았다.
- 회사 소개 기본 그림은 추상적인 빛 표현으로 교체했다. 실제 공장·설치 사진으로 제시하지 않는다. 원본 15개 날짜·제목·설명 연혁을 유지하고 현재 월에 자동 생성되던 성장 항목을 제거했다. footer의 `/about#history` 링크가 실제 연혁 영역으로 연결된다. 공통 제목·동작 컴포넌트와 공개 사이트 CSS를 재사용한다.
- 소스 검증: 공통 제목/버튼·메뉴·인증 UI 및 SSR/선택 경로의 집중 테스트 5개 파일 18개를 통과했고, 원본 연혁 15개 날짜·제목을 이전 소스와 비교했다. 이번 변경은 저장소의 실제 Nuxt 화면 구현이며 운영 배포 완료를 뜻하지 않는다.

- 대표 도메인은 `https://dfkorealed.com`이며 회사 소개의 canonical URL은 `https://dfkorealed.com/about`이다. 페이지 래퍼가 서버 렌더링 HTML에 회사 소개 전용 제목·설명, `index, follow`, Open Graph·Twitter URL과 canonical 링크를 제공한다.
- `/about`은 백엔드 동적 사이트맵의 정적 URL에 포함되고 `robots.txt`가 `https://dfkorealed.com/sitemap.xml`을 안내한다.

- 회사의 LED 조명 제조 정체성과 현장 대응 방식을 소개하는 히어로 문구를 표시한다.
- 2013년 설립 이후 원본 기록의 주요 제품 출시와 인증 취득 연혁 15개를 제공한다.
- 페이지 검색 요약에서도 설립 시기와 주요 적용 현장을 일관되게 소개한다.

## 미구현

- 관리자 화면에서 회사 소개 문구와 이미지를 직접 편집하는 기능은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 실제 Nuxt 공개 사이트의 기본 회사 그림은 추상적인 빛 표현이며 제조 현장 기록 사진은 아니다. 선택적 `heroImage` prop으로 제공한 자료는 표시할 수 있지만 관리자 편집·자동 동기화는 없다. 실제 브라우저 검수와 운영 배포 범위는 이번 사이트 리디자인 검수 기록과 구분해서 관리한다.

- 2026-09-06 Google Search Console과 네이버 서치어드바이저의 사이트 등록 및 `https://dfkorealed.com/sitemap.xml` 제출을 확인했다. 이후 회사 소개 URL의 색인 상태와 선택된 canonical을 정기적으로 확인한다.
- 매월 Search Console과 서치어드바이저에서 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 점검한다. 사이트맵 제출만으로 검색 노출이나 순위가 보장되지는 않는다.

- 실제 회사·제조 사진을 추가할 경우 촬영 맥락과 출처를 확인하고 추상적인 빛 그림과 구분해 제공한다.
- 연혁에 추가되는 제품 출시·인증 정보는 관련 증빙과 함께 최신 상태로 관리해야 한다.

## 관련 파일

- `led-lighting-website/public/branding/df-korea-logo-white.png`
- `output/logo-comments-20261005/README.md`

- `output/site-redesign-20261004/about-320.jpg`

- `led-lighting-website/src/app.vue`
- `led-lighting-website/src/components/layout/{TheNavigation.vue,TheNavigation.spec.ts,TheFooter.vue}`
- `led-lighting-website/src/components/common/site/{PublicPageHeader.vue,PublicAction.vue,PublicAction.spec.ts}`
- `led-lighting-website/src/assets/styles/public-site.css`
- `docs/superpowers/specs/2026-10-04-liquid-light-site-redesign-design.md`
- `docs/superpowers/plans/2026-10-04-liquid-light-site-redesign.md`

- `led-lighting-website/src/views/AboutView.vue`
- `led-lighting-website/src/pages/about.vue`
- `led-lighting-website/nuxt.config.ts`
- `led-lighting-website/public/robots.txt`
- `dfkorea-backend/src/seo/seo.controller.ts`
- `led-lighting-website/src/components/about/AboutHero.vue`
- `led-lighting-website/src/components/about/CompanyTimeline.vue`

## 갱신 규칙

- 실제 공개 사이트의 메뉴 경로·현재 표시·모바일 접근성·헤더 톤·회사 그림·연혁·footer 연락처를 바꾸면 이 문서와 영향을 받는 공개 메뉴 문서를 같은 작업에서 갱신한다. 관리자와 견적 상태/통신의 보존 범위 및 실제 검수 증거를 구분한다.

- 회사 소개의 제목·설명·canonical 또는 사이트맵 포함 정책을 바꾸면 이 문서를 같은 작업에서 갱신한다.
- 월간 색인 점검에서 회사 소개 URL의 오류나 중복 canonical이 확인되면 조치와 재검증 결과를 기록한다.

- 회사 소개 문구, 히어로 이미지, 연혁 또는 검색 요약을 변경할 때 이 문서를 같은 작업에서 갱신한다.

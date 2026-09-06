# 회사 소개 메뉴 기능 현황

## 구현 완료

- 대표 도메인은 `https://dfkorealed.com`이며 회사 소개의 canonical URL은 `https://dfkorealed.com/about`이다. 페이지 래퍼가 서버 렌더링 HTML에 회사 소개 전용 제목·설명, `index, follow`, Open Graph·Twitter URL과 canonical 링크를 제공한다.
- `/about`은 백엔드 동적 사이트맵의 정적 URL에 포함되고 `robots.txt`가 `https://dfkorealed.com/sitemap.xml`을 안내한다.

- 회사의 LED 조명 제조 정체성과 현장 대응 방식을 소개하는 히어로 문구를 표시한다.
- 2013년 설립부터 현재까지의 주요 제품 출시와 인증 연혁을 제공한다.
- 페이지 검색 요약에서도 설립 시기와 주요 적용 현장을 일관되게 소개한다.

## 미구현

- 관리자 화면에서 회사 소개 문구와 이미지를 직접 편집하는 기능은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 2026-09-06 Google Search Console과 네이버 서치어드바이저의 사이트 등록 및 `https://dfkorealed.com/sitemap.xml` 제출을 확인했다. 이후 회사 소개 URL의 색인 상태와 선택된 canonical을 정기적으로 확인한다.
- 매월 Search Console과 서치어드바이저에서 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 점검한다. 사이트맵 제출만으로 검색 노출이나 순위가 보장되지는 않는다.

- 히어로 이미지는 외부 이미지 URL을 사용하므로 회사·제조 현장의 실제 사진으로 교체하면 브랜드 신뢰도를 더 높일 수 있다.
- 연혁에 추가되는 제품 출시·인증 정보는 관련 증빙과 함께 최신 상태로 관리해야 한다.

## 관련 파일

- `led-lighting-website/src/views/AboutView.vue`
- `led-lighting-website/src/pages/about.vue`
- `led-lighting-website/nuxt.config.ts`
- `led-lighting-website/public/robots.txt`
- `dfkorea-backend/src/seo/seo.controller.ts`
- `led-lighting-website/src/components/about/AboutHero.vue`
- `led-lighting-website/src/components/about/CompanyTimeline.vue`

## 갱신 규칙

- 회사 소개의 제목·설명·canonical 또는 사이트맵 포함 정책을 바꾸면 이 문서를 같은 작업에서 갱신한다.
- 월간 색인 점검에서 회사 소개 URL의 오류나 중복 canonical이 확인되면 조치와 재검증 결과를 기록한다.

- 회사 소개 문구, 히어로 이미지, 연혁 또는 검색 요약을 변경할 때 이 문서를 같은 작업에서 갱신한다.

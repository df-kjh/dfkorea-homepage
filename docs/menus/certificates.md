# 인증 현황 메뉴 기능 현황

## 구현 완료

- 대표 도메인은 `https://dfkorealed.com`이다. 인증 목록은 `https://dfkorealed.com/certificates` canonical과 목록 전용 제목·설명·`index, follow`·Open Graph·Twitter 메타데이터를 서버 렌더링 HTML에 제공한다.
- 인증 분류 상세는 `https://dfkorealed.com/certificates/:category` 형식의 URL을 사용한다. 분류명은 URL 인코딩하며, 경로에서 만든 제목·설명·`index, follow`·Open Graph·Twitter URL·canonical 링크를 서버 렌더링한다. 브라우저 전용 PDF 라이브러리와 화면 크기 감지를 사용하는 상세 화면 전체는 `ClientOnly`에서 지연 로드한다. 서버 HTML은 분류 메타데이터를 제공하고, 제목·인증서 수·선택기·다운로드·로딩 및 오류 상태·PDF 본문은 브라우저에서 렌더링한다.
- 백엔드 동적 사이트맵은 인증 목록과 각 고유 인증 분류의 절대 canonical URL을 포함한다. 목록 그룹·상세 필터·경로 기반 canonical·사이트맵 모두 앞뒤 공백을 제거하고, null·빈 문자열·공백뿐인 분류는 `기타`로 정규화한다. Vue Router가 디코딩한 분류를 다시 디코딩하지 않으며, 같은 분류는 한 URL로 통합하며, 해당 분류의 가장 최근 수정일을 `lastmod`로 제공한다.
- Nuxt 페이지가 메타데이터를 단독 관리한다. 인증서 선택은 페이지의 제목·설명만 갱신하고, canonical·Open Graph URL·Twitter URL은 추적 쿼리·해시·접속 호스트와 무관하게 정규화한 대표 분류 URL을 유지한다.
- `robots.txt`는 `https://dfkorealed.com/sitemap.xml`을 안내한다. 관리자 경로(`/admin/**`)와 개발용 `/tailwind-test`는 `noindex, nofollow` 헤더와 robots 규칙으로 수집 대상에서 제외한다.

## 미구현

- 검색엔진 계정의 소유권 확인 토큰 발급과 Search Console·서치어드바이저의 사이트맵 등록 자동화는 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 2026-09-06 Google Search Console과 네이버 서치어드바이저의 사이트 등록 및 `https://dfkorealed.com/sitemap.xml` 제출을 확인했다. 새 인증 분류는 동적 사이트맵에 자동 포함되며, 긴급 반영이 필요한 분류만 URL 검사·재수집을 요청한다.
- 매월 Search Console과 서치어드바이저에서 인증 URL의 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 노출·순위를 보장하지 않는다.
- 인증 상세의 본문 전체는 클라이언트 렌더링이므로 JavaScript를 실행하지 않는 수집기는 인증서 목록·선택기·PDF 내용을 초기 HTML에서 읽을 수 없다. 본문 색인이 필요하면 화면과 PDF 뷰어의 렌더링 경계를 나누고, PDF 접근성·텍스트 추출 상태를 검증해야 한다.

## 관련 파일

- `led-lighting-website/src/views/CertificatesView.vue`
- `led-lighting-website/src/views/CertificateDetailView.vue`
- `led-lighting-website/src/views/certificates-indexing.spec.ts`
- `led-lighting-website/src/utils/certificate-category.ts`
- `led-lighting-website/src/pages/certificates/index.vue`
- `led-lighting-website/src/pages/certificates/[id].vue`
- `led-lighting-website/nuxt.config.ts`
- `led-lighting-website/vercel.json`
- `led-lighting-website/public/robots.txt`
- `dfkorea-backend/src/seo/seo.controller.ts`
- `dfkorea-backend/src/seo/seo.controller.spec.ts`
- `dfkorea-backend/src/seo/seo.module.ts`

## 갱신 규칙

- 인증 목록·분류 상세의 제목·설명·canonical, 분류 정규화·인코딩, 사이트맵 URL 생성 방식 또는 PDF 렌더링 방식이 바뀌면 이 문서를 같은 작업에서 갱신한다.
- 월간 색인 점검에서 인증 URL의 오류나 제외 사유가 확인되면 조치와 재검증 결과를 기록한다.

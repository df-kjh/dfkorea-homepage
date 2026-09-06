# 인증 현황 메뉴 기능 현황

## 구현 완료

- 대표 도메인은 `https://dfkorealed.com`이다. 인증 목록은 `https://dfkorealed.com/certificates` canonical과 목록 전용 제목·설명·`index, follow`·Open Graph·Twitter 메타데이터를 서버 렌더링 HTML에 제공한다.
- 인증 분류 상세는 `https://dfkorealed.com/certificates/:category` 형식의 URL을 사용한다. 분류명은 URL 인코딩하며, 경로에서 만든 제목·설명·`index, follow`·Open Graph·Twitter URL·canonical 링크를 서버 렌더링한다. PDF 뷰어만 클라이언트에서 불러와 메타데이터 렌더링을 방해하지 않는다.
- 백엔드 동적 사이트맵은 인증 목록과 각 고유 인증 분류의 절대 canonical URL을 포함한다. 공백 분류는 `기타`로 정규화하고, 같은 분류는 한 URL로 통합하며, 해당 분류의 가장 최근 수정일을 `lastmod`로 제공한다.
- `robots.txt`는 `https://dfkorealed.com/sitemap.xml`을 안내한다. 관리자 경로(`/admin/**`)와 개발용 `/tailwind-test`는 `noindex, nofollow` 헤더와 robots 규칙으로 수집 대상에서 제외한다.

## 미구현

- 검색엔진 계정의 소유권 확인 토큰 발급과 Search Console·서치어드바이저의 사이트맵 등록 자동화는 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 배포 후 Google Search Console과 네이버 서치어드바이저에 `https://dfkorealed.com/sitemap.xml`을 제출하고, 인증 목록과 대표 인증 분류 상세의 URL 검사·재수집을 요청해야 한다.
- 매월 Search Console과 서치어드바이저에서 인증 URL의 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 노출·순위를 보장하지 않는다.
- 인증 상세의 본문 PDF는 브라우저 전용 뷰어로 렌더링한다. 검색엔진이 인증 내용 자체를 해석해야 하는 요구가 생기면 PDF 접근성·텍스트 추출 상태를 별도로 검증해야 한다.

## 관련 파일

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

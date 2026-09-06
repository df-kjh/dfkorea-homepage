# 소식 메뉴 기능 현황

## 구현 완료

- 대표 도메인은 `https://dfkorealed.com`이다. 소식 목록은 `https://dfkorealed.com/blog` canonical과 목록 전용 제목·설명·`index, follow`·Open Graph·Twitter 메타데이터를 서버 렌더링 HTML에 제공한다.
- 소식 상세는 `https://dfkorealed.com/blog/:id` canonical과 게시글별 메타데이터·구조화 데이터를 서버 렌더링한다. 백엔드 동적 사이트맵은 소식 목록과 각 공개 게시글 상세의 절대 canonical URL을 포함하며, 게시글 변경 사항은 다음 사이트맵 응답에 반영된다.
- 소식 카드는 실제 `href`를 가진 `/blog/:id` NuxtLink 앵커를 렌더링한다. 검색로봇과 키보드 사용자는 목록 HTML에서 상세 페이지를 발견할 수 있고, 기존 카드 클릭 동작도 유지한다.

## 미구현

- 검색엔진 계정의 소유권 확인 토큰 발급과 Search Console·서치어드바이저의 사이트맵 등록 자동화는 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 배포 후 Google Search Console과 네이버 서치어드바이저에 `https://dfkorealed.com/sitemap.xml`을 제출하고, 소식 목록과 최신 소식 상세의 URL 검사·재수집을 요청해야 한다.
- 매월 Search Console과 서치어드바이저에서 소식 URL의 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 노출·순위를 보장하지 않으므로 게시글 제목, 본문, 내부 링크 품질을 계속 관리한다.

## 관련 파일

- `led-lighting-website/src/pages/blog/index.vue`
- `led-lighting-website/src/pages/blog/[id].vue`
- `led-lighting-website/src/components/blog/BlogGrid.vue`
- `led-lighting-website/src/components/blog/BlogGrid.spec.ts`
- `led-lighting-website/nuxt.config.ts`
- `led-lighting-website/public/robots.txt`
- `dfkorea-backend/src/seo/seo.controller.ts`
- `dfkorea-backend/src/seo/seo.module.ts`

## 갱신 규칙

- 소식 목록·상세의 제목·설명·canonical, 카드 링크, 구조화 데이터 또는 사이트맵 URL 생성 방식이 바뀌면 이 문서를 같은 작업에서 갱신한다.
- 월간 색인 점검에서 소식 URL의 오류나 제외 사유가 확인되면 조치와 재검증 결과를 기록한다.

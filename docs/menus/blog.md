# 소식 메뉴 기능 현황

## 구현 완료

- 대표 도메인은 `https://dfkorealed.com`이다. 소식 목록은 `https://dfkorealed.com/blog` canonical과 목록 전용 제목·설명·`index, follow`·Open Graph·Twitter 메타데이터를 서버 렌더링 HTML에 제공한다.
- 소식 상세는 `https://dfkorealed.com/blog/:id` canonical과 게시글별 메타데이터·구조화 데이터를 서버 렌더링한다. 백엔드 동적 사이트맵은 소식 목록과 각 공개 게시글 상세의 절대 canonical URL을 포함하며, 게시글 변경 사항은 다음 사이트맵 응답에 반영된다.
- 소식 카드는 실제 `href`를 가진 `/blog/:id` NuxtLink 앵커를 렌더링한다. Nuxt 페이지가 API의 첫 20개 게시글을 서버에서 가져와 기존 화면·카드에 전달하므로 초기 목록 HTML에 해당 상세 링크와 실제 카드 내용이 포함된다. hydration 시 같은 데이터를 재사용하고 추가 페이지는 기존 클라이언트 무한 스크롤로 불러온다. 검색로봇과 키보드 사용자는 목록 HTML에서 초기 항목의 상세 페이지를 발견할 수 있고, 기존 카드 클릭 동작도 유지한다.

- 목록 메타데이터는 Nuxt 페이지가 단독 관리하여 브라우저 로딩 후에도 쿼리·해시·접속 호스트가 대표 URL을 덮어쓰지 않는다. 빌드 검증은 정확히 하나의 경로별 canonical과 1개 이상의 실제 상세 앵커를 생성 HTML에서 확인한다.

## 미구현

- 검색엔진 계정의 소유권 확인 토큰 발급과 Search Console·서치어드바이저의 사이트맵 등록 자동화는 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- Vercel의 초기 목록 HTML은 빌드 시점 첫 페이지의 스냅샷이다. 초기 카드 변경은 재배포가 필요하고, 첫 페이지 밖 항목은 클라이언트 추가 로딩과 동적 사이트맵으로 발견한다. API 실패나 비어 있는 초기 목록으로 상세 링크를 만들 수 없으면 현재 운영 빌드 검증이 실패하므로 데이터/연결 상태를 확인해야 한다.
- 2026-09-06 Google Search Console과 네이버 서치어드바이저의 사이트 등록 및 `https://dfkorealed.com/sitemap.xml` 제출을 확인했다. 새 게시글은 동적 사이트맵에 자동 포함되며, 긴급 반영이 필요한 게시글만 URL 검사·재수집을 요청한다.
- 매월 Search Console과 서치어드바이저에서 소식 URL의 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 노출·순위를 보장하지 않으므로 게시글 제목, 본문, 내부 링크 품질을 계속 관리한다.

## 관련 파일

- `led-lighting-website/src/views/list-indexing.spec.ts`
- `led-lighting-website/scripts/verify-search-indexing.mjs`
- `led-lighting-website/src/views/BlogView.vue`
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

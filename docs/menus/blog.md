# 소식 메뉴 기능 현황

## 구현 완료

- 2026-10-05 추가 주석 반영: 공통 헤더의 로고 영역 배경을 투명하게 변경했다. 어두운 Hero에서는 흰색 로고를 유지하고 밝은 헤더에서는 CSS로 로고 글자를 어둡게 표시한다. 이미지·메뉴 경로·헤더 높이는 유지한다.

- 2026-10-05 주석 반영: 공통 헤더에 첨부한 회사 로고의 배경 제거·흰색 PNG를 적용했다. 밝은 헤더에는 로고 영역만 어두운 바탕을 두며 홈 링크·회사소개/제품/인증/소식 경로와 모바일 메뉴를 유지한다. 공통 푸터의 상단 문의 문구·전화·메일 영역을 제거하고 하단 메뉴·회사 주소·FAX·저작권은 유지한다.

- 2026-10-04 통합: 별도 `codex/liquid-light-site` 브랜치의 `e106a16`을 로컬 `main`에 병합했고 병합 후 소스 491개를 재검증했다. 기존 미커밋 시안 기록은 보존하며 원격 push·운영 배포는 하지 않았다.

- 2026-10-04 최종 통합 검수: 소스 Vitest 64개 파일/491개, Nuxt 타입 검사, 운영 API를 지정한 빌드와 SEO/상세 앵커 검증을 통과했다. 실제 Chrome에서 기존 네 메뉴와 상세 경로·320px 가로 넘침·Hero/원본 자료를 확인했다. 로컬 검수 증거는 `output/site-redesign-20261004/README.md`를 따른다. 운영 배포와 실제 견적 접수는 수행하지 않았다.

- 2026-10-04 실제 Nuxt 소식 UI 재설계(로컬, 미배포): /blog와 활성 pages/blog/[id].vue를 paper/ink/champagne 제목·분류·실제 사진/날짜 카드·기사/공유·관련 소식으로 갱신했다. 공통 BlogCard/CategoryFilter와 실제 API SSR 첫 20개·갱신/무한 스크롤/실패·목록 클릭 조회수/이동, 상세 SSR/404·canonical/BlogPosting JSON-LD·안전한 Markdown·공유/링크 복사·태그·관련 글을 유지했다. 게시글/사진/API를 가짜 기록으로 대체하지 않았다.
- 제품/소식/견적·Markdown 및 홈 수명주기 연결 집중 검사 17개 파일/100개와 수정 Vue SFC 20개의 script/template 컴파일을 통과했다. 실제 Chrome에서 목록 총 140개/SSR 초기 20개, 현재 불러온 회사소식 분류와 전체 복원, 실제 첫 카드 상세 href·본문/날짜/태그/관련 글 2개 링크를 확인했다. 1440px·390px 상세와 320px 목록(폭 310px/스크롤 폭 310px)에 가로 넘침이 없었다. 일반 카드 클릭은 기존 조회수/선택 이벤트를 유지하고 Cmd/Ctrl/Shift/Alt/비주버튼 클릭은 원본 href의 브라우저 동작을 보존한다. 외부 공유는 실행하지 않았으며 커밋·배포하지 않았다.

- 2026-09-07 관리자 보안 보완: 게시글 생성·수정·삭제, 파일 업로드 및 자동 게시 실행은 쿠키 기반 관리자 중계와 백엔드 JWT 검증을 거친다. 공개 조회와 조회수 증가 경로는 유지한다. 세션·제한사항은 [관리자 문서](admin.md)를 따른다.

- 대표 도메인은 `https://dfkorealed.com`이다. 소식 목록은 `https://dfkorealed.com/blog` canonical과 목록 전용 제목·설명·`index, follow`·Open Graph·Twitter 메타데이터를 서버 렌더링 HTML에 제공한다.
- 소식 상세는 `https://dfkorealed.com/blog/:id` canonical과 게시글별 메타데이터·구조화 데이터를 서버 렌더링한다. 백엔드 동적 사이트맵은 소식 목록과 각 공개 게시글 상세의 절대 canonical URL을 포함하며, 게시글 변경 사항은 다음 사이트맵 응답에 반영된다.
- 소식 카드는 실제 `href`를 가진 `/blog/:id` NuxtLink 앵커를 렌더링한다. Nuxt 페이지가 API의 첫 20개 게시글을 서버에서 가져와 기존 화면·카드에 전달하므로 초기 목록 HTML에 해당 상세 링크와 실제 카드 내용이 포함된다. hydration 시 같은 데이터를 재사용하고 추가 페이지는 기존 클라이언트 무한 스크롤로 불러온다. 검색로봇과 키보드 사용자는 목록 HTML에서 초기 항목의 상세 페이지를 발견할 수 있고, 기존 카드 클릭 동작도 유지한다.

- 목록 메타데이터는 Nuxt 페이지가 단독 관리하여 브라우저 로딩 후에도 쿼리·해시·접속 호스트가 대표 URL을 덮어쓰지 않는다. 빌드 검증은 정확히 하나의 경로별 canonical과 1개 이상의 실제 상세 앵커를 생성 HTML에서 확인한다.

## 미구현

- 게시글 북마크 영구 저장은 제공하지 않는다. 기존 안내 동작은 저장했다고 주장하지 않고 링크 공유 이용을 안내한다.

- 검색엔진 계정의 소유권 확인 토큰 발급과 Search Console·서치어드바이저의 사이트맵 등록 자동화는 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 소식 분류는 현재 불러온 게시글에 적용하는 기존 동작이며 서버 전체 분류 검색이 아니다. 화면에 이 범위를 표시한다. navigator.share/clipboard 연결은 유지하되 검수 중 외부 공유를 실행하지 않는다. API/SSR/SEO를 보존했고 로컬 공개 중계 사용과 운영 배포를 구분한다. 새 Nuxt UI 검증과 이전 시안을 혼합하지 않는다.

- Vercel의 초기 목록 HTML은 빌드 시점 첫 페이지의 스냅샷이다. 초기 카드 변경은 재배포가 필요하고, 첫 페이지 밖 항목은 클라이언트 추가 로딩과 동적 사이트맵으로 발견한다. API 실패나 비어 있는 초기 목록으로 상세 링크를 만들 수 없으면 현재 운영 빌드 검증이 실패하므로 데이터/연결 상태를 확인해야 한다.
- 2026-09-06 Google Search Console과 네이버 서치어드바이저의 사이트 등록 및 `https://dfkorealed.com/sitemap.xml` 제출을 확인했다. 새 게시글은 동적 사이트맵에 자동 포함되며, 긴급 반영이 필요한 게시글만 URL 검사·재수집을 요청한다.
- 매월 Search Console과 서치어드바이저에서 소식 URL의 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 노출·순위를 보장하지 않으므로 게시글 제목, 본문, 내부 링크 품질을 계속 관리한다.

## 관련 파일

- `led-lighting-website/public/branding/df-korea-logo-white.png`
- `output/logo-comments-20261005/README.md`

- `output/site-redesign-20261004/{news-desktop,news-detail-desktop,news-detail-mobile,blog-320}.jpg` (메인 실제 Chrome 검수 화면)

- `led-lighting-website/src/components/blog/{BlogHeader,BlogCard,BlogDetailHero,BlogDetailHeader,BlogDetailTags,RelatedArticles,CategoryFilter}.vue`
- `led-lighting-website/src/components/common/site/{PublicPageHeader,PublicAction}.vue`
- `led-lighting-website/src/assets/styles/public-site.css`
- `docs/superpowers/specs/2026-10-04-liquid-light-site-redesign-design.md`
- `docs/superpowers/plans/2026-10-04-liquid-light-site-redesign.md`
- `.superpowers/sdd/2026-10-04-liquid-light-site-redesign/{README.md,preview-relay.py,progress.md}` (로컬 ignored 검수 자료)

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

- 실제 Nuxt 소식 목록/활성 상세·공통 카드·분류 범위·공유/북마크 안내를 바꾸면 기능·제한·검수·미배포 상태를 함께 갱신한다. legacy BlogDetailView와 활성 Nuxt 페이지를 구분한다.

- 소식 목록·상세의 제목·설명·canonical, 카드 링크, 구조화 데이터 또는 사이트맵 URL 생성 방식이 바뀌면 이 문서를 같은 작업에서 갱신한다.
- 월간 색인 점검에서 소식 URL의 오류나 제외 사유가 확인되면 조치와 재검증 결과를 기록한다.

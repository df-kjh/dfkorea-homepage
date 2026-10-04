# 인증 현황 메뉴 기능 현황

## 구현 완료

- 2026-10-04 최종 통합 검수: 소스 Vitest 64개 파일/491개, Nuxt 타입 검사, 운영 API를 지정한 빌드와 SEO/상세 앵커 검증을 통과했다. 실제 Chrome에서 기존 네 메뉴와 상세 경로·320px 가로 넘침·Hero/원본 자료를 확인했다. 로컬 검수 증거는 `output/site-redesign-20261004/README.md`를 따른다. 운영 배포와 실제 견적 접수는 수행하지 않았다.

- 실제 Chrome 검수: 390px KS 분류 상세에서 원본 인증서 문서와 브라우저 PDF 툴바가 표시되는 것을 확인했다. 선택 문서의 원본 iframe title/src·select·다운로드 연결을 유지한다. 320px 인증 목록의 clientWidth/scrollWidth는 310/310으로 가로 넘침이 없었다. 증거: `output/site-redesign-20261004/certificates-detail-mobile.jpg`, `output/site-redesign-20261004/certificates-320.jpg`. 최종 `npm run type-check`와 인증/공통 UI 집중 테스트 18개가 통과했다.

- 2026-10-04 실제 Nuxt 인증 화면 Liquid Light 적용: `/certificates`의 라이브 API 자료를 기존 정규화된 분류로 묶고, 각 분류를 키보드로 사용할 수 있는 실제 인코딩된 `NuxtLink`로 제공한다. 공통 공개 제목·동작 컴포넌트와 paper 문서 배열을 사용하며 원본 분류명·문서 수를 유지한다. API 실패는 빈 목록과 구분해 재시도 버튼을 표시한다.
- 인증 상세는 기존 `ClientOnly`·원본 PDF 렌더러·선택 이벤트·다운로드 URL·canonical 계약을 유지한다. 문서 선택은 레이블이 있는 기본 select로 제공한다. PDF 로딩/렌더링 실패를 표시하고 미리보기 재시도를 지원하며, 실패한 경우에만 선택 문서명 title과 원본 URL을 가진 브라우저 PDF iframe을 표시한다. 다운로드는 같은 원본 자료로 연결한다. 인증 유효기간·공급 범위·새 인증 실적을 임의 생성하지 않는다.
- 소스 검증: 기존 blank/padded/`효율 100%` 분류, 실제 링크, 선택된 PDF, SSR→hydration→선택 중 canonical 유지 회귀를 포함한 집중 테스트 5개 파일 18개를 통과했다. 원본 KS PDF는 HTTP 200·PDF 형식이지만 localhost Origin GET에 CORS 헤더가 없어 JS 렌더러 실패가 발생함을 확인했다. API/R2 설정을 변경하지 않고 원본 iframe을 보완했다. 실제 브라우저 문서 표시 검수와 운영 배포 완료는 별도로 기록한다.

- 2026-09-07 관리자 보안 보완: 인증서 생성·수정·삭제와 이미지/PDF 업로드는 쿠키 기반 관리자 중계와 백엔드 JWT 검증을 거친다. PDF는 형식을 확인한 뒤 첨부 다운로드로 제공한다. 세션·제한사항은 [관리자 문서](admin.md)를 따른다.

- 대표 도메인은 `https://dfkorealed.com`이다. 인증 목록은 `https://dfkorealed.com/certificates` canonical과 목록 전용 제목·설명·`index, follow`·Open Graph·Twitter 메타데이터를 서버 렌더링 HTML에 제공한다.
- 인증 분류 상세는 `https://dfkorealed.com/certificates/:category` 형식의 URL을 사용한다. 분류명은 URL 인코딩하며, 경로에서 만든 제목·설명·`index, follow`·Open Graph·Twitter URL·canonical 링크를 서버 렌더링한다. 브라우저 전용 PDF 라이브러리와 화면 크기 감지를 사용하는 상세 화면 전체는 `ClientOnly`에서 지연 로드한다. 서버 HTML은 분류 메타데이터를 제공하고, 제목·인증서 수·선택기·다운로드·로딩 및 오류 상태·PDF 본문은 브라우저에서 렌더링한다.
- 백엔드 동적 사이트맵은 인증 목록과 각 고유 인증 분류의 절대 canonical URL을 포함한다. 목록 그룹·상세 필터·경로 기반 canonical·사이트맵 모두 앞뒤 공백을 제거하고, null·빈 문자열·공백뿐인 분류는 `기타`로 정규화한다. Vue Router가 디코딩한 분류를 다시 디코딩하지 않으며, 같은 분류는 한 URL로 통합하며, 해당 분류의 가장 최근 수정일을 `lastmod`로 제공한다.
- Nuxt 페이지가 메타데이터를 단독 관리한다. 인증서 선택은 페이지의 제목·설명만 갱신하고, canonical·Open Graph URL·Twitter URL은 추적 쿼리·해시·접속 호스트와 무관하게 정규화한 대표 분류 URL을 유지한다.
- `robots.txt`는 `https://dfkorealed.com/sitemap.xml`을 안내한다. 관리자 경로(`/admin/**`)와 개발용 `/tailwind-test`는 `noindex, nofollow` 헤더와 robots 규칙으로 수집 대상에서 제외한다.

## 미구현

- 검색엔진 계정의 소유권 확인 토큰 발급과 Search Console·서치어드바이저의 사이트맵 등록 자동화는 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 원격 PDF 저장소가 fetch CORS를 허용하지 않으면 자바스크립트 미리보기가 실패할 수 있다. 이 경우 원본 iframe과 원본 다운로드를 제공하지만 모든 모바일 브라우저의 내장 PDF 지원은 동일하지 않다. 저장소 CORS 정책이나 서버 중계는 이번 공개 화면 변경 범위에 포함하지 않았다.

- 2026-09-06 Google Search Console과 네이버 서치어드바이저의 사이트 등록 및 `https://dfkorealed.com/sitemap.xml` 제출을 확인했다. 새 인증 분류는 동적 사이트맵에 자동 포함되며, 긴급 반영이 필요한 분류만 URL 검사·재수집을 요청한다.
- 매월 Search Console과 서치어드바이저에서 인증 URL의 색인 제외 사유, 크롤링 오류, 중복 canonical, 구조화 데이터 오류를 확인한다. 사이트맵 제출은 발견과 수집을 돕지만 노출·순위를 보장하지 않는다.
- 인증 상세의 본문 전체는 클라이언트 렌더링이므로 JavaScript를 실행하지 않는 수집기는 인증서 목록·선택기·PDF 내용을 초기 HTML에서 읽을 수 없다. 본문 색인이 필요하면 화면과 PDF 뷰어의 렌더링 경계를 나누고, PDF 접근성·텍스트 추출 상태를 검증해야 한다.

## 관련 파일

- `output/site-redesign-20261004/certificates-320.jpg`

- `output/site-redesign-20261004/certificates-detail-mobile.jpg`

- `led-lighting-website/src/views/{CertificatesView.spec.ts,CertificateDetailView.spec.ts}`
- `led-lighting-website/src/components/common/site/{PublicPageHeader.vue,PublicAction.vue}`
- `led-lighting-website/src/assets/styles/public-site.css`
- `docs/superpowers/specs/2026-10-04-liquid-light-site-redesign-design.md`
- `docs/superpowers/plans/2026-10-04-liquid-light-site-redesign.md`

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

- 인증 자료의 실제 링크·키보드 선택·API 오류/재시도·PDF 오류/원본 대체 표시·다운로드 접근성을 변경하면 이 문서와 분류/선택/SEO 회귀 테스트를 같은 작업에서 갱신한다. 원본 응답·브라우저 표시·유효성 확인을 서로 구분한다.

- 인증 목록·분류 상세의 제목·설명·canonical, 분류 정규화·인코딩, 사이트맵 URL 생성 방식 또는 PDF 렌더링 방식이 바뀌면 이 문서를 같은 작업에서 갱신한다.
- 월간 색인 점검에서 인증 URL의 오류나 제외 사유가 확인되면 조치와 재검증 결과를 기록한다.

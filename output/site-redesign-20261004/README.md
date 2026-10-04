# DF KOREA 실제 사이트 Liquid Light 리디자인 검수

2026-10-04 실제 Nuxt 공개 페이지에 적용한 디자인입니다. 기존 별도 `public/liquid-light-landing/` 프로토타입과 구분합니다.

## 화면

- 실제 사이트: http://127.0.0.1:5192/
- 유지한 경로: 회사소개 `/about`, 제품 `/products` 및 상세, 인증 `/certificates` 및 분류, 소식 `/blog` 및 상세.
- [홈 첫 화면](home-desktop.jpg), [홈 전체](home-fullpage-desktop.jpg), [모바일 홈](home-mobile.jpg), [회사소개](about-desktop.jpg), [제품](products-desktop.jpg), [제품 상세](products-detail-desktop.jpg), [인증](certificates-desktop.jpg), [모바일 원본 PDF](certificates-detail-mobile.jpg), [소식](news-desktop.jpg), [소식 상세](news-detail-mobile.jpg).
- [브라우저 동작 기록](browser-checks.json), [보존한 API/types/server/admin 64개 소스 검사](protected-source-check.json).

## 확인한 동작

실제 Chrome GPU에서 Hero의 빛 흐름·네이티브 포인터 좌표/강도·빈 영역 클릭 파동·수동 정지·스크롤 절전·다시 진입 재생을 확인했습니다. 라우트 이탈 뒤 canvas 0개와 문서 진단값 제거, reduced-motion 진단에서 시간 0/정적 렌더, fallback 진단에서 CSS 화면을 확인했습니다. OS 설정을 바꾸거나 실제 GPU 오류·물리 터치 기기를 시험한 것은 아닙니다.

메뉴 네 개는 실제 페이지 링크이며 제품 상세에서도 현재 제품 메뉴가 활성화됩니다. 모바일 메뉴 Escape는 토글로 포커스를 돌려주고 경로 이동하면 닫힙니다. 320px에서 홈/회사소개/제품/인증/소식의 clientWidth와 scrollWidth가 310/310으로 같았습니다. 가로 carousel의 내부 스크롤은 유지합니다. 홈의 파트너 8개/공간 참고 6개/실제 주요 제품 4개 이미지를 모두 로드했습니다. 참고 사진을 자사 시공 실적으로 추가 주장하지 않습니다.

실제 공개 데이터는 제품 25개/인증 문서 50개/소식 140개입니다. 몰드바 검색은 1개, 40W 사양 필터는 15개를 표시합니다. PIPE 원본 이미지 2개와 모델/길이를 표시하고 임시 전기 사양은 제외합니다. 확대 image 쿼리/ESC 닫기/견적 초안 담기를 확인했습니다. 소식 첫 20개 링크와 실제 상세 Markdown·날짜·태그·관련 2개 링크를 확인했습니다. 카드 수정키 클릭은 단위 회귀로 기본 링크 동작을 검사했습니다.

KS 분류는 실제 2개 문서를 선택하고 원본 다운로드 링크를 제공합니다. 저장소 CORS 때문에 JS PDF 렌더러가 실패할 때 원본 iframe으로 전환하여 모바일 Chrome에서 인증서 문서와 툴바 표시를 확인했습니다. 브라우저별 내장 PDF 지원에는 차이가 있습니다.

## 소스 검증

- `VITE_API_BASE_URL=http://localhost:3000 ./node_modules/.bin/vitest run src --reporter=dot`: 64개 파일/491개 PASS.
- `npm run type-check`: PASS.
- `VITE_API_BASE_URL=https://dfkorea-production.up.railway.app npm run build`: PASS; 내부 중계 서버 산출물, 회사 SEO, 제품/소식 SSR 상세 앵커 각 20개, canonical/indexing guard 통과.
- production API bundle guard PASS: 실제 HTTPS API가 9개 산출물에 포함됐고 localhost fallback은 없었습니다. 소스/스테이징 diff 검사 PASS.
- 기존 `npm test`의 별도 public Node 테스트 수집/기본 .env fixture 문제는 작업 시작 전부터 존재합니다. 전체 src 회귀는 명시적인 테스트 전용 환경으로 검사했습니다.

## 로컬 검수와 운영 구분

5192 Nuxt는 원본 공개 API 응답을 전달하는 5292 loopback 검수 중계를 사용합니다. 생산 빌드는 실제 HTTPS API를 지정했습니다. 중계는 관리자/인증/임의 목적지/일반 쓰기를 거절하고 견적 세션 POST도 허용하지 않습니다. 초안 담기·창 열기/닫기·스타일을 확인했으며 개인정보 입력·사업자 확인·실제 견적 접수·메일 발송은 수행하지 않았습니다. 기존 견적/API controller는 보존합니다.

셰이더는 제공된 예시의 Matthias Hurrle (@atzedent) noise/domain-warp 표기를 유지합니다. 첨부에 상업 라이선스 확인 자료가 없어 CC0/상업 사용 확인 완료로 기록하지 않습니다.

별도 `codex/liquid-light-site` 브랜치에서 구현하고 검증한 뒤 로컬 main에 병합합니다. 기존 미커밋 문서·프로토타입은 커밋에 섞지 않고 보존합니다. 원격 push와 운영 배포는 이 작업에 포함하지 않습니다.

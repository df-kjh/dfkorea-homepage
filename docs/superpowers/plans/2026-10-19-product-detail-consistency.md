# Product detail consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 몰드바의 공통 구성과 설치 예시를 전체 제품에 적용하고 치수·제어 표현을 수정한다.
**Architecture:** 기존 detailContent v1을 유지하며 공통 컴포넌트와 유형별 기본 콘텐츠/에셋만 확장한다. 세 작업자는 파일 소유권을 분리하고 부모는 계획·결과·검수만 취합한다.
**Tech Stack:** Nuxt/Vue/TypeScript/Vitest, 기존 imagegen 도구.
**Spec:** `docs/superpowers/specs/2026-10-19-product-detail-consistency-design.md`

## Global Constraints

- 몰드바 기준 공통 섹션·디자인, 제품별 실제 사진·사양. 없는 성능·각도·부품·인증 생성 금지.
- 실제 제품 옵션에 있는 제어만 지원 기능으로 표시한다. 개별 격등 비동기, 그룹 한 줄 3개 동기, 비상 1000ms 후 상시 점등.
- 네모는 치수 외곽 안내이며 실제 제품 형상이 아니다. 선 끝은 대응 꼭짓점과 정확히 정렬한다.
- 기존 관리자의 명시적 입력과 v1 계약·갤러리·제품군·견적·SEO를 보존한다.
- 원본과 기존 몰드바 에셋은 덮어쓰지 않는다. 생성 이미지에 공통 연출 표기를 유지한다.
- 운영 DB/API 쓰기·배포는 하지 않는다. 새 브랜치 작업 후 로컬 main 병합.

## Review Focus

- 수치가 여러 세트이거나 타공·PIPE인 경우 치수를 추정하지 않는다.
- 탭 전환/재진입·unmount가 비상 타이머와 애니메이션 상태를 남기지 않는다.
- 프리뷰/모바일/동작 감소 설정에서도 애니메이션 제어가 접근 가능하다.
- 새 유형/1장 사진/관리자 override가 설치 및 구조 영역을 불필요하게 숨기지 않는다.
- 생성 이미지가 잘못된 제품 형태·문자·성능을 주장하지 않으며 파일이 전부 로딩된다.

## Tasks

### 1. 공통 제어와 치수
Owner: DetailControl.vue, DetailDimensions.vue, 신규 ControlSimulation.vue/scoped CSS, dimensions.ts 및 해당 테스트. 기존 공용 detail.css/content.ts/템플릿은 다른 작업자 소유.
- [x] 테스트 먼저 실패 확인: 제어 상태/시간 경계/탭 cleanup/키보드 및 치수 파싱·측정선.
- [x] 공통 시뮬레이션·일시정지/다시보기 및 공통 네모 치수 도식 구현.
- [x] 템플릿의 DetailDimensions에 product prop 필요 여부 통지.
- [x] 집중 테스트·린트 실행, 보고서 기록.

### 2. 전체 제품 공통 콘텐츠·설치 영역
Owner: content.ts, application-profiles.ts, DetailStory.vue, DetailHero.vue, ProductDetailTemplate.vue, detail.css, 관련 테스트, docs/menus/products.md/admin.md/quote.md.
- [x] 25개 모든 원 제품의 기본 설치/구조 섹션과 관리자 override 테스트 실패 확인.
- [x] 몰드바 기준 제목·순서·영역 통일, 유형별 실제 사용처·사양 기반 문구.
- [x] 신규 에셋 manifest 14종 연결. 기존 몰드바/제품군/프리뷰/갤러리/견적 보존.
- [x] 집중 테스트·린트 및 메뉴 문서 업데이트, 보고서 기록.

### 3. 설치 이미지 14종
Owner: public/images/product-detail/applications/**, 해당 README/manifest, output/product-detail-consistency-20261019/** assets report/prompts. 제품 코드는 다른 작업자 소유.
- [x] 기존 제품 사진을 유형별로 확인하고 참조를 지정한다.
- [x] imagegen 스킬·내장 도구로 각 유형 하나씩 14개 신규 이미지 생성. 독립 호출을 병렬화할 수 있다.
- [x] 제품 형태·실제 적용 공간·문자/워터마크 부재를 눈으로 확인하고 프로젝트 경로에 보존.
- [x] 모든 최종 파일과 프롬프트·참조·유형 매핑을 보고한다.

### 4. 통합 검수/리뷰/마무리
- [x] 프런트 전체 테스트·타입·변경 린트·빌드 및 기존 백엔드 문서 검사 통과.
- [x] 독립 리뷰 및 필요 수정/재검토.
- [x] 실제 25개 설치 영역/도식, 격등·그룹·비상 1초 전환, PC/모바일 검수.
- [ ] 로컬 main 병합 후 완성된 브라우저 화면과 검증/미배포 상태 제공.

## Progress ledger

- 시작: main 8292bd1에서 codex/product-detail-consistency 생성. 기존 미배포 템플릿/제품군 구현과 output 자료 보존.
- 작업 1: 소스 동결. 선행 실패 후 집중 테스트 30개·변경 린트 통과 보고를 받았으며 독립 리뷰를 시작했다. 최종 전체 검증과 브라우저 동작 검수는 남아 있다.
- 작업 2: 공통 슬로건과 실제 제품명을 h1 안에 함께 유지한다. 기존 제품명 단독 h1 테스트는 현재 제품명 포함·라우트/SEO 요구를 보존하도록 조정한다.
- 작업 3: 설치 예시 8/14종 생성·참조 외형 시각 검토 완료 보고. 남은 6종과 최종 manifest 대기.
- 작업 2: 집중 107개·변경 린트 통과 보고. 비선형 소개 제목의 의미 조정은 허용하되 이전에 삭제한 히어로 자동 안내 문구는 제거하도록 검토 결과를 반영한다.
- 작업 3 완료: 14개 PNG 원본과 복사본 해시·무결성 확인. 독립 리뷰도 모든 이미지를 참조 사진과 대조했다. 공개 manifest에서 사용자 절대경로/전체 프롬프트/도구 출력은 제거했다.
- 리뷰 수정: SSR에서 비상 타이머가 생성되는 문제를 mount 이후로 제한. Node SSR 3개 회귀를 포함한 집중 33개가 통과했다. 재검토와 최종 통합 검증 대기.
- 통합 1차: 프런트 77파일/686테스트, 타입, 변경 린트, 빌드와 검색/릴레이 산출물 확인이 통과했다. 백엔드 문서 검사 8개도 통과했다.
- 실제 GET 검수: 25/25 원 ID가 자신의 제품명 h1과 소개/구조/설치/치수 순서를 유지하고, 신규 14/14 PNG가 HTTP 200 image/png로 로딩된다. 운영 쓰기는 없다.
- 실제 UI: 개별 1·3·5만 서로 다른 밝기·시간 변화, 그룹3개 같은 높이/밝기 변화, 발전기/배터리 초기 OFF와 이후 ON 확인. Node 테스트가 정확한 999/1000ms 경계를 보증한다.
- 모바일 후속: 밝은 cover 이미지의 본문 대비를 강화하고 320px 치수 숫자를 약12px로 확대했다. 원형/선형 라벨 모두 SVG 경계 안에 있음을 DOM으로 확인하고 스크린샷을 남겼다. 관리자 PC/375px 미리보기도 확인했다.
- 독립 최종 리뷰: 미해결 P0–P3 없음. 마지막 모바일 CSS도 별도 재검토했다. 최종 소스 검사 재실행과 로컬 main 통합만 남았다.
- 최종 소스 재검증: 프런트 77파일/686테스트, 타입·변경 린트·빌드 및 검색/릴레이 산출물 검사 모두 종료0. 추가된 문서를 포함한 백엔드 문서 검사도 8개 통과. 제품 소스 동결 상태이며 로컬 병합을 진행한다.

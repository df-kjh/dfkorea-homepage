# 제품 상세페이지 템플릿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 승인된 몰드바 시안을 모든 제품에 재사용하고 관리자가 새 제품의 상세 콘텐츠를 편집할 수 있게 한다.

**Architecture:** 기존 Product 사양을 원천으로 공통 Vue 렌더러와 관리자 편집기를 연결하고 선택적인 version 1 JSONB 콘텐츠를 추가한다. 카탈로그 통합 조사는 독립적으로 진행하며 애매한 항목은 사용자에게 확인한다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, NestJS, TypeORM/PostgreSQL, Jest.

**Spec:** `docs/superpowers/specs/2026-10-19-product-detail-template-design.md`

## Global Constraints

- 모든 제품에 같은 디자인; 사양의 단일 원천은 기존 Product 필드. 몰드바 문구/에셋 프리셋은 몰드바 ID에만 한정한다.
- 사용자 주석 여덟 항목을 제거한다. 나머지 정보를 임의 삭제하지 않는다.
- 이전 Markdown·기술 이미지·SEO·사진 확대·견적 담기를 유지한다.
- 새 JSON 계약은 위 spec과 정확히 일치한다. URL/문자열/배열 크기를 검증한다.
- 실제 관리자 인증/업로드 경계를 사용한다. 운영 저장·배포·DB 변경은 이번 검증에서 실행하지 않는다.
- 불분명한 제품 통합은 질문한다. 추정으로 제품을 삭제/병합하지 않는다.
- 부모는 오케스트레이터로 계획·결과·검증만 취합한다. 구현은 파일 소유권이 분리된 작업자가 담당한다.

## 작업 체크리스트

### 1. 카탈로그 비교 (read-only)
- [x] 공개 전체 응답·페이지 수와 원본을 보존한다. 25개 SKU.
- [x] 통합 후보의 모든 주요 필드를 대조하고 확실/보류/유지로 구분한다. 원형 안전 통합, 나머지 후보 차이 기록.
- [x] 애매한 항목을 사용자에게 질문한다. 주차장 상시/디밍 통합 승인, 칠판 별도 유지 답변 수신.

### 2. Backend 콘텐츠 저장
소유: `dfkorea-backend/src/products/**`, `src/entities/product.entity.ts`, 새 migration, `database-schema.md`.
- [x] DTO 실패 사례 테스트를 먼저 추가하고 실패 확인.
- [x] nullable detailContent JSONB, 엄격한 nested DTO, migration 추가.
- [x] 누락/null/기존 데이터 호환·생성/수정 저장 검증.
- [x] 관련 Jest, 타입, 빌드 실행; 작업 보고서 기록.

### 3. 공개 상세 공통 템플릿
소유: frontend `src/types/product-detail.ts`, types/index.ts, components/products/detail/**, pages/products/[id].vue, 승인 프리셋 에셋, 정적 prototype, docs/menus/products.md/quote.md.
- [x] 공통 모델·안전한 기본값·누락/PIPE 예외 테스트 작성.
- [x] 승인 시안과 삭제 요청을 반영한 분리된 컴포넌트로 모든 실제 상세에 적용.
- [x] 기존 설명·확대·견적·SEO 유지 확인.
- [x] 정적 검토 화면도 같은 삭제 사항 반영; 새 immutable preview 버전 생성.
- [x] 관련 테스트와 브라우저용 결과 보고서 기록.

### 4. 관리자 편집기
소유: frontend components/admin/product-detail/**, views/admin/ProductFormView.vue, 관련 테스트, docs/menus/admin.md.
- [x] 생성/수정 저장 왕복 테스트와 미리보기 테스트 작성.
- [x] 업로드·이미지·문구·선택적 섹션 설정·공통 렌더러 미리보기 구현.
- [x] 불러오기/저장/초기화 시 콘텐츠 손실과 기타 제품 사양 변경 방지.
- [x] 관련 테스트 및 작업 보고서 기록.

### 5. 통합 검수와 리뷰
- [x] 양쪽 관련 테스트와 프런트 전체 테스트/타입 및 양쪽 빌드 확인.
- [x] 독립 리뷰로 계약·기능·이전 기능 보존 검토 후 필요한 수정.
- [x] 로컬 PC/모바일 실제 상세와 관리자 미리보기 확인; 사용자에게 화면 제공.
- [x] 제품 통합 답변 반영 또는 보류 목록 명시. 운영 변경 상태 명시.

### 6. 확정한 두 제품군 묶기
소유: backend 제품군 응답 helper/controller/service/entity virtual property 및 테스트; frontend 응답 타입/공개 목록 호출/카드/선택 UI와 테스트. 기존 작업자와 동시 파일 편집 금지.
- [x] backend 검토 완료 그룹 정의와 fail-open 공통 사양 검증 테스트; grouped pagination/filter와 단건 응답 구현.
- [x] 프런트 공개 목록만 groupVariants=true; 관리자/견적 선택기는 원 SKU 조회 유지.
- [x] 상세 구성 선택을 원 ID로 이동시켜 실제 사진/전력/인증/견적 ID 보존.
- [x] API 원본 25개 및 그룹 23개, 주차장 50W/친환경 범위, 센서 비상 옵션 격리, 예전 URL 확인.
- [x] 관련 메뉴 문서·검증 결과 갱신.

## Progress ledger

- 2026-10-19 시작: main에서 `codex/product-detail-template` 브랜치 생성. 기존 untracked 몰드바 시안 보존. 현재 운영 변경 없음.
- catalog_audit_v2: 읽기 전용 25개 제품 비교 진행.
- catalog_audit_v2: 완료. 원본 25개, 완전 중복 0쌍, 안전한 원형 제품군 1쌍, 공개 자료 사진 54개 검토. 보고서 output/product-catalog-audit-20261019/catalog-audit.ko.md.
- 사용자 답변: 주차장 상시/디밍 통합 + 구성별 전력/인증 유지 승인. 칠판은 별도 유지.
- Backend 콘텐츠/제품군 구현: DTO/저장 HTTP 및 그룹 테스트 132개 통과, 타입/린트/빌드 통과. 독립 backend 리뷰 Approved, 지적 없음.
- 공개 템플릿/관리자/프런트 제품군 구현: 최종 작업자 전체 Vitest 75 files/594 tests 통과. 부모 Nuxt 타입 검사 및 production API 기반 빌드/SEO 아티팩트 검사 exit 0.
- 부모 backend 전체 첫 실행: 1183 pass, 116 skip, 1 fail. products.md의 미배포 제목을 운영 가이드로 인식하는 기존 문서 검사 실패를 수정했고 해당 8개 테스트 재실행 통과. 최종 전체 재실행 예정.
- 부모 실제 브라우저: 정적 주석 수정 v7, 실제 몰드바 사진 확대/닫기, 주차장 상시→디밍 URL/모델/전력/인증 전환 확인. 390px에서 가로 넘침 없음. 운영 데이터가 아닌 메모리 QA API로 후속 검수.
- 독립 frontend 리뷰: Needs changes — P2 관리자 미리보기의 기존 API 상대 이미지 주소 보정 누락 1건. 단일 fixwave 작업자 배정. 모바일 긴 사용자 설명 겹침은 실제 화면 확인 예정.

- 최종 부모 검증: 프런트 전체 75 files/595 tests PASS; 백엔드 전체 79 suites/1184 tests PASS, 기존 2 suites/116 tests skip. 양쪽 타입 검사·변경 파일 ESLint·빌드 exit 0. 프런트 G2B/SEO/검색 색인 아티팩트 검증 PASS.
- 최종 독립 재검토: P2 ADDRESSED, 수정 범위 신규 결함 없음. 추가 모바일 긴 설명 겹침은 실제 375px에서 CTA 이후 사진까지 69.438px 간격으로 해결 확인.
- 실제 로컬 UI: 관리자 로그인→직접 편집→PC/375px 미리보기→저장→공개 페이지 반영→재불러오기→null 기본값 초기화→저장 통과. 검수 데이터는 메모리 대체 저장소이며 운영 DB/R2에 쓰지 않음.
- 실제 공개 로컬 UI: 23개 목록, 원형 일반/센서 및 주차장 상시/디밍 네 원 ID 전환, 몰드바 사진 확대/닫기, 320px(본문310px)/390px에서 가로 넘침 없음. 25개 모든 원 주소 SSR 200/단일 h1/자기 모델/canonical 일치.
- 실 DB SQL 실행·운영 관리자/R2 업로드·고객 견적 접수/메일·운영 배포는 미실행. 새 컬럼은 운영 반영 시 기존 정식 배포 절차의 마이그레이션으로 적용해야 함.

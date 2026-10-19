# Product detail feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 사용자 주석 7개와 설치 이미지 6종의 구체적인 수정 요청을 공통 상세 템플릿에 반영한다.
**Architecture:** UI/문구는 기존 공유 컴포넌트에서 수정하고, 이미지 수정본은 6개 v2 파일로 연결한다. 부모는 계획·검증·결과 취합만 담당한다.
**Tech Stack:** Nuxt/Vue/TypeScript/Vitest, built-in image_gen.
**Spec:** 이번 사용자 주석 1–7 및 여섯 설치 이미지 수정 지시.

## Global Constraints

- 일시정지/다시보기 버튼, 제어 패널 헤더, 사양 안내 문구, 히어로 모델/제품명 표시 행, 히어로 사진 확대 버튼, 섹션 제목 앞 장식 선을 삭제한다.
- ‘1초 후’는 모든 비상 제어 공개 문구·접근성 설명에서 제거한다. 데모의 내부 1000ms 전환은 유지하며 실제 제품 전환 시간으로 설명하지 않는다.
- 히어로의 보이는 모델 행은 제거하되 제품별 접근 가능한 h1 식별·메타·JSON-LD·실제 사양·원본 사진 확대는 보존한다.
- 등록된 제어 옵션만 제공하고 타이머 cleanup/SSR mount 경계/감소된 동작 설정을 유지한다.
- 6개 v2 이미지: classroom, pipe-pendant, street, parking-guidance, wall-light, cleanroom. 다른 이미지와 실제 등록 제품 사진은 변경하지 않는다.
- 공개 manifest에는 개인 경로·전체 프롬프트를 넣지 않고 생성 이력은 output에 남긴다.
- 운영 DB 쓰기·원격 push·배포는 하지 않는다. 별도 브랜치 후 로컬 main에 병합한다.

## Review Focus

- 버튼 삭제 이후 비상 탭 재진입/타이머 해제와 디밍·감소된 동작이 유지되는가.
- 제거한 문구가 aria-label/상태 표시/다른 공통 페이지에서 되살아나지 않는가.
- 제품명 화면 행을 지워도 h1의 제품 식별 및 견적/제품군 경로가 유지되는가.
- 칠판등은 직사각 고정판이 벽면에 밀착하고 빛이 칠판 아래를 향하는가. 가로등은 수직 기둥·수평 등기구·건물/도로 대비 자연스러운 크기인가.
- 차량유도등 글씨가 명확하고, 주차장/램프 환경 및 크린룸 엔드캡 표현이 요청과 일치하는가.

## Tasks

### 1. 공통 UI와 연결
Owner: shared detail components/tests, application-profiles.ts, public applications README/manifest, docs/menus products/admin/quote.
- [x] 지정 요소 제거와 공개 문구·접근성 요구를 반영하고 기존 동작 회귀를 검증한다.
- [x] 준비된 6개 v2 파일을 프로필/manifest/README에 연결하고 메뉴 문서를 갱신한다.
- [x] 집중 테스트·변경 린트 보고 후 소스를 동결한다.

### 2. 설치 이미지 수정 A
Owner: classroom-v2.png, pipe-pendant-v2.png, street-v2.png 및 output의 images-a 기록만.
- [x] 이전 생성물·실제 제품 참조 사진을 확인한다.
- [x] 내장 image_gen으로 수정본 3개를 생성·시각 검토·저장하고 프롬프트/해시를 보고한다.

### 3. 설치 이미지 수정 B
Owner: parking-guidance-v2.png, wall-light-v2.png, cleanroom-v2.png 및 output의 images-b 기록만.
- [x] 이전 생성물·실제 제품 참조 사진을 확인한다.
- [x] 내장 image_gen으로 수정본 3개를 생성·시각 검토·저장하고 프롬프트/해시를 보고한다.

### 4. 통합
- [x] 독립 리뷰 후 필요한 수정과 재검토.
- [x] 프런트 전체 테스트·타입·변경 린트·빌드 및 관련 문서 검사.
- [x] 브라우저에서 삭제 요소/비상 제어/6개 이미지/PC·모바일 결과를 확인하고 스크린샷 보존.
- [ ] 기능 커밋·로컬 main 병합과 병합 결과 검증, 미배포 상태 및 미리보기 제공.

## Progress ledger

- 시작: main a909ded에서 codex/product-detail-feedback 생성. 기존 output 기록·v1 에셋 보존.
- UI 1차 동결: 주석 7개를 공통 템플릿에서 제거하고 집중 8파일/139개·변경 린트 통과 보고. 히어로 하단 제품명/모델명은 삭제 범위가 아니므로 보존했다. 여섯 v2 프로필/공개 metadata 연결 작업 중.
- 에셋 A/B 완료: 내장 image_gen 6회와 가로등 크기 추가 교정 1회. v1 보존, 6개 v2를 원본 크기로 검토했다. 부모와 독립 리뷰도 벽 고정·하향 조명·환경·비율·문자·엔드캡 조건을 대조해 확인했다.
- 실제 UI 1차: 삭제 클래스 모두 0, 비상 문구에 시간 보장 없음, 모든 kicker before가 none, 히어로 하단 식별 유지. 비상 최초 OFF 확인. 전체 연결 동결 후 최종 검증을 이어간다.
- 최종 source freeze: 공통 버전표로 6개 v2/8개 v1을 연결했다. 프로필 환경·alt와 공개 README/manifest·메뉴 문서를 갱신했다. 활성 이미지 14개 실제 해시/크기·치수와 공개 메타데이터 정리 상태를 부모가 재검증했다.
- 독립 리뷰: UI/타이머/SSR·여섯 이미지·메타데이터·매핑·메뉴 문서에 미해결 P0–P3 없음. 독립 집중 97개 통과.
- 통합 1차: 프런트 77파일/684개 테스트·타입·폴더 린트 모두 종료0. 문서 검사 8개 통과, 빌드 및 최종 브라우저 확인 진행 중.
- 최종 검증: 운영 API 지정 빌드와 검색/상세 앵커·G2B 릴레이 산출물 검증 종료0. GET 25/25 상세에서 제거 대상 부재와 제품별 h1/하단 식별 보존, 활성 PNG14/14 로딩을 확인했다. 실제 브라우저도 6개 v2의 로딩·원본 폭1672px를 확인했다.
- UI 최종: 비상 OFF→ON 상시 점등과 밝은 색상 스타일 유지, 시간 문구·버튼·패널 헤더 부재 확인. 390px 칠판/제어 상세 모두 clientWidth=scrollWidth 380px, 상단 모델행 없음. 원형·선형 치수 도식은 이전 검증을 보존한다. 출력 자료는 output/product-detail-feedback-20261019에 기록했다.

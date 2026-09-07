# Tender analysis optional profile and historical catch-up plan

**Goal:** 회사 정보 없이도 입찰 사양·가격 분석을 사용할 수 있음을 명확히 하고, 2026-09-01 00:00 KST 이후의 기존 공고를 배포 후 자동 분석한다.

**Scope decisions:**

- 회사 프로필은 계속 완전 선택 사항이다. 프로필이 없으면 사양·문서·가격 분석은 수행하고 참가 조건·인증만 `UNKNOWN`, 전체 판정은 최대 `REVIEW`로 제한한다.
- 부분 프로필을 잘못된 `미보유`로 해석하지 않도록 이번 작업에서 DB nullable/삼상태 모델은 추가하지 않는다.
- 회사 자격 폼은 선택 사항임을 먼저 안내하고 상세 입력을 접어서 필요할 때만 연다. 판정에 사용되지 않는 공급물품 분류는 신규 입력 UI에서 제거하되, 기존 저장값은 PUT 시 보존한다.
- 자동 분석 기준은 `2026-09-01T00:00:00+09:00`이다. 새 필수 환경변수나 migration은 추가하지 않는다.
- 기존 공고 큐 등록은 제한된 배치, `FOR UPDATE SKIP LOCKED`, `tenderId` 고유키를 이용해 재시작과 다중 인스턴스에서 멱등하게 처리한다.

## Task 1: Make the company profile optional and lightweight

- [x] 회사 프로필이 없어도 COMPLETED/PARTIAL 사양·가격 결과가 유지되고 참가 조건·인증만 UNKNOWN인지 백엔드 회귀 테스트를 보강한다.
- [x] 관리 화면의 버튼과 빈 상태를 `선택 사항`으로 바꾸고, 회사 정보 없이 사용할 수 있는 범위를 설명한다.
- [x] 자격·실적 입력을 접이식 상세 설정으로 배치하고 판정 미사용 공급물품 신규 입력 UI를 제거하되 기존 값은 보존한다.
- [x] 프런트엔드 접근성·초안 보존·저장 검증 테스트와 `docs/menus/tenders.md`를 갱신한다.
- [x] 구현 커밋 후 요구사항 적합성 및 코드 품질 검토를 통과한다.

## Task 2: Queue and process notices collected before deployment

- [x] `TenderAnalysisService.queueMissingAnalysesSince(since, limit)`를 추가해 기준일 이후 지원 공고 중 분석 행이 없는 오래된 순서의 제한 배치를 등록한다.
- [x] G2B 물품과 K-apt만 포함하고, G2B 비물품·기타 공급자는 제외하며 반복/동시 호출의 멱등성을 PostgreSQL 테스트로 검증한다.
- [x] scheduler 시작 시 한 배치를 등록하고 매분 `등록 → processDue` 순서로 보충하여 전체 backlog가 결국 소진되도록 한다.
- [x] PENDING 무작업/실제 대기/PROCESSING 메시지를 구분하고 불필요한 오해를 없앤다.
- [x] `docs/menus/tenders.md`에 기준일, 자동 보충, 처리 한계를 기록한다.
- [x] 구현 커밋 후 요구사항 적합성 및 코드 품질 검토를 통과한다.

## Task 3: Final verification

- [x] 백엔드 전체 CI와 계약 테스트를 실행한다.
- [x] 일회용 PostgreSQL이 가능하면 큐 동시성/통합 테스트를 실행하고, 없으면 해당 경계를 명시한다.
- [x] PostgreSQL 16 깨끗한 DB에서 기존 제품 배열 변환 migration이 전체 migration을 막지 않도록 호환성을 복구하고 AppModule 통합 6건을 통과한다.
- [x] 프런트엔드 테스트, 타입 검사, 프로덕션 빌드를 실행한다.
- [x] 전체 변경 범위를 최종 코드 검토하고 모든 Critical/Important 발견을 해결한다.
- [x] 로컬 결과만 준비하고 원격 push, 배포, 운영 DB backfill은 수행하지 않는다.

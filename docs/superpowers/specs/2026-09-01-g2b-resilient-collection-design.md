# G2B 광범위 공고 수집 안정화 및 K-apt 원문 링크 수정 설계

## 1. 목적

나라장터의 공사·물품·용역 공고를 기존처럼 모두 수집하면서, 공공데이터포털의 간헐적 제한 또는 일시 오류 하나가 G2B 전체 수집을 무조건 실패시키는 문제를 제거한다. 물품 납품·MAS 중심 분류는 다시 도입하지 않는다. K-apt 공고의 공식 원문 버튼은 현재 유효한 상세 페이지로 이동하도록 신규·기존 데이터를 함께 수정한다.

## 2. 확인된 원인과 설계 전제

- 운영 환경과 같은 API 키·URL·시간 범위로 공사 7페이지, 물품 7페이지, 용역 9페이지를 직접 호출하면 모두 정상 응답했다. 따라서 키 만료, URL, operation 이름의 고정 오류가 아니다.
- 현재 롤백된 어댑터는 공사·물품·용역을 `Promise.all`로 동시에 시작하고, 어느 한 operation의 한 페이지라도 비정상 provider code를 반환하면 이미 성공한 결과까지 버리고 G2B 전체를 `FAILED`로 끝낸다.
- 현재 오류 객체는 operation, page, provider result code를 보존하지 않는다. 이 때문에 collect API에는 `PROVIDER_RESULT_ERROR`만 보이고 Railway 로그에는 원인 경계가 남지 않는다.
- 같은 입력이 직접 재현에서는 성공하고 실제 수집에서는 간헐적으로 실패하므로, 공급자의 일시적 응답 및 병렬 호출 타이밍을 견디는 수집 경계가 필요하다.
- 현재 K-apt 어댑터가 만드는 `https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=...`는 실공고 번호로 HTTP 404를 반환한다. 공식 사이트의 현재 상세 경로 `https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=...`는 같은 번호로 HTTP 200과 상세 내용을 반환한다.

## 3. 범위

### 3.1 포함

- G2B 공사·물품·용역 operation의 순차 실행
- 한 G2B 클라이언트 안에서 모든 페이지 요청 시작 간격 제한
- 읽기 요청에 안전한 제한적 재시도
- operation별 성공 결과 보존과 G2B 부분 성공 처리
- 민감정보를 제외한 operation·page·provider code 로깅
- collect API와 즉시 수집 UI의 `PARTIAL` 상태 처리
- 회귀 테스트와 입찰 메뉴 기능 문서 갱신
- K-apt 신규 공고의 공식 상세 URL 생성 수정
- 기존 K-apt 공고의 잘못된 URL을 행 삭제 없이 일괄 보정하는 migration

### 3.2 제외

- 물품 납품·MAS 전용 수집, 표시 또는 메일 제한
- 나라장터 면허제한 API 추가
- K-apt·KEPCO 수집 주기·분류·재시도 정책 변경
- DB 스키마 변경 또는 기존 공고·메일 행 삭제
- 외부 작업 큐나 별도 수집 서버 도입

## 4. 수집 구조

### 4.1 operation 순서

`G2bTenderAdapter`는 다음 operation을 순서대로 실행한다.

1. `getBidPblancListInfoCnstwk` — 공사
2. `getBidPblancListInfoThng` — 물품
3. `getBidPblancListInfoServc` — 용역

각 operation 안의 페이지도 순차 조회한다. 한 클라이언트가 마지막 요청 시작 시각을 공유하며 요청 시작 간격을 최소 1,100ms로 제한한다. 응답 대기 시간은 이 간격에 추가될 수 있다.

### 4.2 재시도

각 페이지는 최초 호출 외 최대 2회 재시도한다. 지연은 1초, 3초로 제한한다.

재시도 대상은 읽기 요청에서 안전하게 재실행할 수 있는 다음 일시 오류다.

- provider result code `23`(초당 요청 제한)
- HTTP `429`, `502`, `503`, `504`
- request timeout 또는 network error

인증·설정·응답 계약 오류와 그 밖의 provider result code는 재시도하지 않는다. 재시도하더라도 API 키, URL query, provider body는 로그에 기록하지 않는다.

### 4.3 부분 성공

operation별 오류를 격리한다. 성공한 operation의 정규화 공고는 유지하고, 실패한 operation만 오류 메타데이터로 반환한다.

- 세 operation 성공: `SUCCEEDED`
- 일부 성공: `PARTIAL`, 성공 공고 저장, `errorCode=PARTIAL_PROVIDER_FAILURE`
- 모두 실패: `FAILED`, 저장 공고 없음, 대표 안전 오류 코드 기록

부분 성공 실행은 마지막 완전 성공 watermark로 사용하지 않는다. 다음 정기·수동 수집은 기존 마지막 `SUCCEEDED` 시각에서 1시간 겹쳐 다시 조회해 누락된 operation을 복구한다. 기존 중복 키 upsert가 재조회 중복을 흡수한다.

## 5. 오류와 관측성

`TenderSourceError`는 외부 응답에 노출하지 않는 안전 메타데이터를 가진다.

- `operation`
- `pageNo`
- `providerResultCode`
- HTTP status

Railway 경고 로그는 다음 정보만 포함한다.

`source`, `errorCode`, `operation`, `pageNo`, `providerResultCode`, `httpStatus`, `attempt`

API 키, 전체 URL, query string, provider 응답 본문, 예외 cause는 로그와 collect 응답에 포함하지 않는다. collect 응답은 기존 출처별 집계에 `PARTIAL`과 안전 오류 코드만 제공한다.

## 6. UI 동작

즉시 수집 결과가 `PARTIAL`이면 G2B 전체 실패로 표현하지 않고 “나라장터 일부 유형 수집 실패, 다음 수집에서 재시도”로 안내한다. `SUCCEEDED`는 기존 성공 안내를 유지하고, `FAILED`가 하나라도 있으면 기존 일부 수집 실패 안내를 유지한다.

공고 캘린더·목록·메일 대상은 계속 직접·잠재 LED 관련도만 사용한다. 공사·물품·용역은 모두 표시 및 발송 대상이 될 수 있다.

## 7. 테스트 전략

테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다.

- 세 operation이 동시에 시작되지 않고 정의된 순서로 호출되는지 검증
- 공유 클라이언트의 페이지 요청 시작 간격 검증
- code `23`과 허용된 HTTP·network 일시 오류만 최대 2회 재시도하는지 검증
- 인증·설정·영구 provider 오류를 재시도하지 않는지 검증
- 한 operation 실패 시 성공 공고를 `PARTIAL`로 반환하고 저장하는지 검증
- 모두 실패 시 `FAILED`가 되는지 검증
- `PARTIAL`이 완전 성공 watermark로 선택되지 않는 기존 조회 조건 검증
- 로그와 collect 응답에 키·URL·provider body가 포함되지 않는지 검증
- K-apt 어댑터가 `/bid/bidDetail.do?bidNum=` 공식 URL을 생성하는지 검증
- URL 보정 migration이 K-apt의 기존 `/web/bid/` 링크만 수정하고 다른 출처와 이미 올바른 링크는 건드리지 않는지 검증
- 백엔드 전체 CI, 계약 테스트, 프론트엔드 테스트·운영 빌드 실행
- 배포 후 Railway/Vercel 성공, 운영 API HTTP 200 확인

## 8. K-apt 공식 원문 링크

`KaptTenderAdapter`는 `sourceNoticeId`를 URL encoding해 다음 canonical URL을 저장한다.

`https://www.k-apt.go.kr/bid/bidDetail.do?bidNum={sourceNoticeId}`

이미 저장된 공고도 즉시 고치기 위해 data migration을 실행한다. migration은 `source='KAPT'`이고 기존 `/web/bid/bidDetail.do?bidNum=` prefix를 가진 행의 `sourceUrl`만 새 prefix로 치환한다. 공고 ID, 공고번호, 원문 응답, 관련도, 수집·메일 이력은 변경하거나 삭제하지 않는다. rollback은 해당 migration이 만든 canonical K-apt prefix만 이전 prefix로 되돌린다.

## 9. 데이터 안전과 배포

DB 스키마 변경은 없다. G2B 관련 데이터는 수정하지 않으며 기존 `tenders`, `tender_sync_runs`, 메일 이력을 유지한다. K-apt data migration은 잘못된 `sourceUrl` 문자열만 비파괴적으로 보정하고 어떤 행이나 이력도 삭제하지 않는다.

구현은 새 커밋으로 `main`에 푸시하고 Railway·Vercel 자동 배포를 확인한다. 운영 관리자 인증이 필요한 collect endpoint는 배포 상태와 서버 health 확인 후 사용자가 즉시 수집으로 최종 확인한다.

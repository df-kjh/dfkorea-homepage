# 입찰 공고

## 구현 완료

- 관리자 좌측 메뉴의 `입찰 공고` 탭에서 등록일 기준 월간 공고를 조회한다.
- 캘린더는 이전·다음 달 날짜를 포함한 7열 × 6주, 총 42개 셀을 항상 표시한다.
- 월간 전체·💡 직접 관련·⚡ 잠재 관련 건수와 일자별 건수를 표시하고, 날짜를 선택하면 해당 날짜의 목록을 페이지 단위로 조회한다.
- 필터는 검색어, 출처, 지역, 공고 유형, 관련도만 제공하며 공고 목록과 월간 캘린더 집계에만 적용된다.
- 지역은 입력 문자열을 포함하는 부분 검색이며 `%`, `_`, `!`는 일반 문자로 안전하게 처리한다.
- 수신 설정은 사용 여부, 최대 20개 이메일 주소, 공통 발송 시각만 저장하며 캘린더 필터를 포함하지 않는다.
- 공고 상세는 출처·기관·등록/마감 일시·분류 근거와 안전한 공식 원문 링크를 제공한다.
- 목록과 상세의 등록·마감 일시는 `Asia/Seoul`로 일관되게 표시하고, 큰 추정 금액은 bigint 정밀도를 유지한다.
- 백엔드는 나라장터·K-apt 공식 API 어댑터와 비활성화된 한전 어댑터, 판정 근거 저장, 등록일(KST) 기준 조회, 수신 주소별 영속 메일 재시도 계약을 구현했다.
- 나라장터는 공사·물품·용역 operation에 `type=json`과 KST `YYYYMMDDHHmm` 등록 범위를 사용하며, 응답의 실제 첨부파일명도 분류 입력에 포함한다.
- 수신 주소를 제거하면 비활성화하고, 다시 추가하면 같은 ID와 발송 이력을 복원한다. 설정 모달은 열 때마다 새 세대로 최신값을 조회하고, 늦게 도착한 이전 요청은 상태를 덮어쓰지 못한다. 최신 조회 실패 상태에서는 저장할 수 없으며 모달 안의 `다시 시도`로 새 요청을 실행한다.
- 수집은 `Asia/Seoul` 기준 `00:00`, `12:00`에만 예약된다. 메일은 매분 공용 설정을 다시 읽고 KST 영업일 고유 claim과 PostgreSQL advisory lock으로 여러 인스턴스·시각 변경에서도 하루 한 번만 실행한다.
- display-only `LED전광판`/`LED 전광판`/`LED디스플레이`/`LED 디스플레이`는 대소문자와 공백 수에 관계없이 일반 LED 근거를 제외한다. display phrase가 공고 어디든 있으면 다른 필드의 bare `LED`도 독립 근거로 보지 않으며, `가로등`·`조명`·`등기구`·`보안등` 같은 구체 조명 근거가 있어야 직접 관련으로 유지한다.
- 일일 claim은 15분 lease를 사용한다. 각 delivery는 `(dailyDispatchId, recipientId)` 고유 identity를 기록한다. recipient delivery를 만들기 전 DB 오류가 나면 완료하지 않고, stale lease 회수 시 기존 `SENT`·재시도·진행 중·불확실·취소/실패·`SKIPPED` outcome이 없는 주소만 재처리한다.

## 미구현

- 입찰 공고의 관리자 수동 등록·수정·삭제 기능은 제공하지 않는다.
- 공고 마감 임박 알림 또는 별도 마감 임박 표시는 제공하지 않는다.
- 수신 주소별 독립 필터·독립 발송 시각은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 나라장터·K-apt는 공식 응답 fixture와 어댑터 계약 테스트만 통과했다. 공공데이터포털에서 승인된 실운영 키로 실제 응답을 받은 검증은 아직 하지 않았다.
- 한전은 LINK API의 승인 계정·실제 OpenAPI 매뉴얼이 없어 기록 계약 fixture만 사용한다. `KEPCO_TENDER_ENABLED=false`가 기본이며, 실제 base URL·인증 파라미터·필드 매핑 검증 전에는 활성화하면 안 된다.
- 네이버웍스 SMTP는 외부 앱 비밀번호가 없는 상태에서 전송기 이중(mock)과 영속 재시도 계약만 검증했다. 스테이징에서 실제 발신 권한, TLS 465 연결, 성공 주소 비중복, 실패 주소 10분 후 1회 재시도를 확인해야 한다.
- 명시적 SMTP `responseCode` 4xx/5xx 거절 또는 Nodemailer의 non-empty recipient `rejected`만 10분 재시도한다. `ETIMEDOUT`, `ECONNECTION`, `ECONNRESET`, `ESOCKET`처럼 negative SMTP 응답이 없는 network/socket 오류는 `command=CONN`이어도 승인 경계를 증명하지 못하므로 즉시 `DELIVERY_UNCERTAIN`으로 종결하고 재전송하지 않는다. SMTP 승인 직후 DB 확정 전 종료도 stale uncertainty로 처리하므로 극히 드문 장애에서는 메일이 누락될 수 있으며 운영에서는 uncertain 이력을 점검해야 한다.
- 빠른 HTTP·서비스 계약 테스트와 화면 테스트는 안전한 이중(mock)을 사용한다. 별도 `test:tender:integration` 실행기는 실제 AppModule, JWT, TypeORM, migration을 검증하도록 준비했지만, 현재 disposable PostgreSQL이 없어 실행하지 못했다. 이 파괴적 러너는 로컬/명시 Docker 테스트 DB만 허용하며 원격 스테이징 DB에는 실행할 수 없다. KST SQL 집계, 다중 연결 lock/unique claim, 권한 만료, 대량 데이터, 모바일 실기기 시각 검증은 배포 전 추가 확인이 필요하다.

## 관련 파일

- `led-lighting-website/src/views/admin/AdminDashboard.vue`
- `led-lighting-website/src/components/admin/TenderManagement.vue`
- `led-lighting-website/src/components/admin/tenders/`
- `led-lighting-website/src/api/tenders.ts`
- `led-lighting-website/src/types/tender.ts`
- `led-lighting-website/src/utils/tender-calendar.ts`
- `dfkorea-backend/src/tenders/`
- `dfkorea-backend/test/tenders.contract-spec.ts`
- `dfkorea-backend/test/tender-app-integration.spec.ts`
- `DEPLOYMENT.md`

## 갱신 규칙

- 입찰 공고 메뉴의 조회, 필터, 상세, 수신 설정 기능을 변경할 때 이 문서를 같은 변경에서 갱신한다.
- 실제 API·SMTP 연동 상태가 바뀌면 `구현 완료`와 운영 한계 항목을 함께 조정한다.
- 캘린더 기준일, 수신 설정 범위, 공고 분류 표기를 변경하면 사용자에게 보이는 동작과 제한을 명시한다.

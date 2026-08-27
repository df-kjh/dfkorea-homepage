# 입찰 공고

## 구현 완료

- 관리자 좌측 메뉴의 `입찰 공고` 탭에서 등록일 기준 월간 공고를 조회한다.
- 캘린더는 이전·다음 달 날짜를 포함한 7열 × 6주, 총 42개 셀을 항상 표시한다.
- 월간 전체·💡 직접 관련·⚡ 잠재 관련 건수와 일자별 건수를 표시하고, 날짜를 선택하면 해당 날짜의 목록을 페이지 단위로 조회한다.
- 필터는 검색어, 출처, 지역, 공고 유형, 관련도만 제공하며 공고 목록과 월간 캘린더 집계에만 적용된다.
- 수신 설정은 사용 여부, 최대 20개 이메일 주소, 공통 발송 시각만 저장하며 캘린더 필터를 포함하지 않는다.
- 공고 상세는 출처·기관·등록/마감 일시·분류 근거와 안전한 공식 원문 링크를 제공한다.
- 백엔드는 나라장터·K-apt 공식 API 어댑터와 비활성화된 한전 어댑터, 판정 근거 저장, 등록일(KST) 기준 조회, 수신 주소별 영속 메일 재시도 계약을 구현했다.
- 수집은 `Asia/Seoul` 기준 `00:00`, `12:00`에만 예약되며, 여러 인스턴스는 PostgreSQL advisory lock으로 한 번만 수집·발송·재시도한다.

## 미구현

- 입찰 공고의 관리자 수동 등록·수정·삭제 기능은 제공하지 않는다.
- 공고 마감 임박 알림 또는 별도 마감 임박 표시는 제공하지 않는다.
- 수신 주소별 독립 필터·독립 발송 시각은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 나라장터·K-apt는 공식 응답 fixture와 어댑터 계약 테스트만 통과했다. 공공데이터포털에서 승인된 실운영 키로 실제 응답을 받은 검증은 아직 하지 않았다.
- 한전은 LINK API의 승인 계정·실제 OpenAPI 매뉴얼이 없어 기록 계약 fixture만 사용한다. `KEPCO_TENDER_ENABLED=false`가 기본이며, 실제 base URL·인증 파라미터·필드 매핑 검증 전에는 활성화하면 안 된다.
- 네이버웍스 SMTP는 외부 앱 비밀번호가 없는 상태에서 전송기 이중(mock)과 영속 재시도 계약만 검증했다. 스테이징에서 실제 발신 권한, TLS 465 연결, 성공 주소 비중복, 실패 주소 10분 후 1회 재시도를 확인해야 한다.
- 빠른 HTTP·서비스 계약 테스트와 화면 테스트는 안전한 이중(mock)을 사용한다. 별도 `test:tender:integration` 실행기는 실제 AppModule, JWT, TypeORM, migration을 검증하도록 준비했지만, 현재 disposable PostgreSQL이 없어 실행하지 못했다. KST SQL 집계, 다중 연결 lock, 권한 만료, 대량 데이터, 모바일 실기기 시각 검증은 배포 전 추가 확인이 필요하다.

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

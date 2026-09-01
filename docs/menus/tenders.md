# 입찰 공고

## 구현 완료

- 관리자 좌측 메뉴의 `입찰 공고` 탭에서 등록일 기준 월간 공고를 조회한다.
- 캘린더는 이전·다음 달 날짜를 포함한 7열 × 6주, 총 42개 셀을 항상 표시한다.
- 월간 전체·💡 직접 관련·⚡ 잠재 관련 건수와 일자별 건수를 표시하고, 날짜를 선택하면 해당 날짜의 목록을 페이지 단위로 조회한다.
- 필터는 검색어, 출처, 지역, 공고 유형, 관련도만 제공하며 공고 목록과 월간 캘린더 집계에만 적용된다.
- 지역은 입력 문자열을 포함하는 부분 검색이며 `%`, `_`, `!`는 일반 문자로 안전하게 처리한다.
- 수신 설정은 최대 20개 이메일 주소와 공통 발송 시각만 입력받으며 캘린더 필터를 포함하지 않는다. 수신 주소가 있는 설정을 저장하면 메일 수신이 자동으로 시작되고, 중지는 별도의 `메일 수신 중지` 버튼으로만 수행해 주소·시각을 유지한다.
- 공고 상세는 출처·기관·등록/마감 일시·분류 근거와 안전한 공식 원문 링크를 제공한다.
- 목록과 상세의 등록·마감 일시는 `Asia/Seoul`로 일관되게 표시하고, 큰 추정 금액은 bigint 정밀도를 유지한다.
- 백엔드는 나라장터·K-apt 공식 API 어댑터와 비활성화된 한전 어댑터, 판정 근거 저장, 등록일(KST) 기준 조회, NAVER WORKS Mail API(HTTPS/OAuth), 수신 주소별 영속 메일 재시도 계약을 구현했다.
- 물품 납품·MAS만 노출하던 기회 유형 제한은 제거했다. 직접·잠재 LED 관련으로 판정된 물품·공사·용역 공고를 이전의 광범위 수집·캘린더·목록·메일 흐름으로 처리한다.
- 나라장터는 공사·물품·용역 operation에 `type=json`과 KST `YYYYMMDDHHmm` 등록 범위를 사용하며, 응답의 실제 첨부파일명도 분류 입력에 포함한다.
- 나라장터는 Railway 직접 수집을 우선한다. HTTP 200이지만 결과 코드가 없는 안전하지 않은 응답만 작업 단위로 Vercel 보안 릴레이를 통해 재시도하므로, 정상 직접 수집 건을 중복 요청하지 않는다.
- Vercel 릴레이는 나라장터 공사·물품·용역의 세 작업과 고정된 한 페이지 쿼리만 허용한다. Railway 직접 수집은 Railway 서버 전용 `PUBLIC_DATA_SERVICE_KEY`를 사용하고, 릴레이 요청에는 `serviceKey`를 넣지 않는다. Vercel은 릴레이 upstream 호출에만 자체 서버 전용 `PUBLIC_DATA_SERVICE_KEY`를 붙인다.
- Vercel 릴레이의 upstream은 `https://apis.data.go.kr/1230000/ad/BidPublicInfoService` 공식 경계만 허용하고 자동 리다이렉트를 거부한다. 공공데이터포털이 반환한 4xx·5xx 상태는 본문을 읽거나 노출하지 않은 채 그대로 백엔드에 전달하므로, 영구 4xx는 한 번만 시도하고 기존 일시 오류 상태만 제한적으로 재시도한다. 프로덕션 빌드는 `/api/internal/g2b-relay`가 Nitro 서버 산출물에 실제 등록됐는지 검사하며 누락되면 배포 빌드를 실패시킨다.
- K-apt 신규 공고의 공식 원문은 현재 상세 경로인 `https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=...`로 저장한다. 기존 `/web/bid/bidDetail.do` 링크는 데이터 마이그레이션으로 K-apt 행의 `sourceUrl`만 비파괴적으로 보정하며 공고·수집·메일 이력은 유지한다.
- 수신 주소를 제거하면 비활성화하고, 다시 추가하면 같은 ID와 발송 이력을 복원한다. 설정 모달은 열 때마다 새 세대로 최신값을 조회하고, 늦게 도착한 이전 요청은 상태를 덮어쓰지 못한다. 최신 조회 실패 상태에서는 저장할 수 없으며 모달 안의 `다시 시도`로 새 요청을 실행한다.
- 수집은 `Asia/Seoul` 기준 매시 정각에 예약된다. 관리자는 필터 왼쪽의 `즉시 수집` 버튼으로 같은 수집 파이프라인을 실행할 수 있고, 완료 후 현재 월 캘린더와 선택 날짜 목록이 갱신된다. 정기·수동 수집이 겹치면 PostgreSQL advisory lock으로 중복 실행을 막는다. 나라장터 공사·물품·용역 중 일부 operation만 실패한 `PARTIAL` 결과는 성공한 공고를 반영하고 `나라장터 일부 유형 수집에 실패했습니다. 다음 수집에서 다시 시도합니다.` 경고를 표시한다. 다른 출처의 `FAILED`가 함께 있으면 출처 실패 안내가 `PARTIAL` 안내보다 우선하며, 일시적인 나라장터 제한·네트워크 오류는 수집 중 제한적으로 재시도하고 복구되지 않은 operation은 다음 정기·수동 수집에서 다시 조회한다. 메일은 매분 공용 설정을 다시 읽고 KST 날짜·설정 시각 고유 claim과 PostgreSQL advisory lock으로 같은 시각의 중복 실행을 막는다. 같은 날 공용 발송 시각을 변경하면 새 슬롯으로 다시 발송할 수 있다.
- display-only `LED전광판`/`LED 전광판`/`LED디스플레이`/`LED 디스플레이`는 대소문자와 공백 수에 관계없이 일반 LED 근거를 제외한다. display phrase가 공고 어디든 있으면 다른 필드의 bare `LED`도 독립 근거로 보지 않으며, `가로등`·`조명`·`등기구`·`보안등` 같은 구체 조명 근거가 있어야 직접 관련으로 유지한다.
- 발송 슬롯 claim은 15분 lease를 사용한다. 각 delivery는 `(dailyDispatchId, recipientId)` 고유 identity를 기록한다. recipient delivery를 만들기 전 DB 오류가 나면 완료하지 않고 stale lease에서 재개한다. 새 설정 시각 슬롯에서는 이미 `SENT`인 공고를 제외하며, 이전 슬롯의 `DELIVERY_UNCERTAIN` 공고는 다시 발송 대상으로 전환한다.
- NAVER WORKS OAuth 시작·연결 상태 API는 관리자 JWT로 보호하고, callback은 10분 유효 SHA-256 state 검증 후에만 토큰을 저장한다. access/refresh token은 배포 secret의 32-byte key로 AES-256-GCM 암호화해 DB에 저장하고, 만료 전 자동 갱신한다.
- 수신 설정 모달에서 NAVER WORKS 연결 상태를 확인하고 최초 연결 또는 재연결을 시작할 수 있다. backend가 반환한 공식 `https://auth.worksmobile.com` URL만 허용하며, OAuth callback 뒤에는 연결 상태를 다시 조회하고 완료 안내를 표시한다.
- 메일은 수신 주소마다 NAVER WORKS HTTPS Mail API를 개별 호출해 주소 상호 노출을 막는다. `202 Accepted`만 성공으로 확정하고, `401`은 토큰을 한 번 강제 갱신한 뒤 같은 호출을 다시 시도한다.

## 미구현

- 입찰 공고의 관리자 수동 등록·수정·삭제 기능은 제공하지 않는다.
- 공고 마감 임박 알림 또는 별도 마감 임박 표시는 제공하지 않는다.
- 수신 주소별 독립 필터·독립 발송 시각은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 나라장터·K-apt는 공식 응답 fixture와 어댑터 계약 테스트만 통과했다. 공공데이터포털에서 승인된 실운영 키로 실제 응답을 받은 검증은 아직 하지 않았다.
- K-apt canonical 상세 경로는 실공고 표본에서 HTTP 200 응답을 확인했지만, 공고별 게시 종료·삭제와 외부 사이트의 향후 경로 변경까지 애플리케이션이 보장할 수는 없다. 배포 후 운영 공고 표본의 `공식 원문 열기`를 주기적으로 확인해야 한다.
- 한전은 LINK API의 승인 계정·실제 OpenAPI 매뉴얼이 없어 기록 계약 fixture만 사용한다. `KEPCO_TENDER_ENABLED=false`가 기본이며, 실제 base URL·인증 파라미터·필드 매핑 검증 전에는 활성화하면 안 된다.
- 릴레이는 Railway의 특정 HTTP 200 응답 이상을 우회하기 위한 보조 경로다. 릴레이에서도 공공데이터포털 응답이 차단되면 파싱 규칙을 완화하지 않고, 허용된 고정 outbound 주소를 갖춘 별도 국내 호스팅 수집기를 마련해야 한다.
- 릴레이 작업 실패 로그에는 응답 원문 대신 `GATEWAY_ERROR_SHAPE`, `UNKNOWN_RESPONSE_SHAPE` 같은 제한된 형태 분류만 기록한다.
- Railway 운영 환경에는 `G2B_RELAY_ENABLED`, `G2B_RELAY_URL`, `G2B_RELAY_SHARED_SECRET`가 필요하다. Vercel 운영 환경에는 동일한 `G2B_RELAY_SHARED_SECRET`과 `G2B_TENDER_API_BASE_URL`, `PUBLIC_DATA_SERVICE_KEY`가 필요하며, 모두 서버 전용 변수로 설정해야 한다.
- NAVER WORKS Mail API는 전송기 이중(mock)과 OAuth 암호화·갱신 및 영속 재시도 계약까지 검증했다. 스테이징에서 실제 Developer Console 앱의 `mail` scope, callback, 발신 계정 승인, `202` 성공, 주소 비중복, `429`/토큰 endpoint 일시 실패의 10분 후 1회 재시도를 확인해야 한다.
- Mail API의 `429`처럼 수신이 명시적으로 거절된 일시 오류만 같은 슬롯에서 10분 뒤 한 번 재시도한다. `401`은 access token을 한 번 갱신하며, 그 밖의 `4xx`는 영구 실패다. Mail API는 idempotency key를 제공하지 않으므로 발송 요청의 network/timeout 오류와 `5xx`는 제공자가 이미 승인했을 가능성을 배제할 수 없어 해당 슬롯에서는 `DELIVERY_UNCERTAIN`으로 종결한다. 이후 관리자가 같은 날 발송 시각을 변경하거나 다음 날짜 슬롯이 열리면 이 공고는 다시 발송될 수 있으므로 드문 경우 중복 메일 가능성이 있다.
- 빠른 HTTP·서비스 계약 테스트와 화면 테스트는 안전한 이중(mock)을 사용한다. 별도 `test:tender:integration` 실행기는 실제 AppModule, JWT, TypeORM, migration을 검증하도록 준비했지만, 현재 disposable PostgreSQL이 없어 실행하지 못했다. 이 파괴적 러너는 로컬/명시 Docker 테스트 DB만 허용하며 원격 스테이징 DB에는 실행할 수 없다. KST SQL 집계, 다중 연결 lock/unique claim, 권한 만료, 대량 데이터, 모바일 실기기 시각 검증은 배포 전 추가 확인이 필요하다.
- 이미 운영 DB에 적용된 `opportunityType`·`opportunityReasons` 컬럼은 기존 데이터와 마이그레이션 이력을 보호하기 위해 삭제하지 않는다. 현재 애플리케이션은 이 레거시 컬럼을 조회·메일 대상 제한에 사용하지 않는다.

## 관련 파일

- `led-lighting-website/src/views/admin/AdminDashboard.vue`
- `led-lighting-website/src/components/admin/TenderManagement.vue`
- `led-lighting-website/src/components/admin/tenders/`
- `led-lighting-website/src/api/tenders.ts`
- `led-lighting-website/src/types/tender.ts`
- `led-lighting-website/src/utils/tender-calendar.ts`
- `dfkorea-backend/src/tenders/`
- `dfkorea-backend/src/tenders/adapters/g2b-relay.fetcher.ts`
- `led-lighting-website/src/server/api/internal/g2b-relay.post.ts`
- `led-lighting-website/src/server/utils/g2b-relay.ts`
- `dfkorea-backend/src/migrations/1787820200000-UseNaverWorksMailApi.ts`
- `dfkorea-backend/src/migrations/1787820300000-DropLegacyTenderSmtpMessageId.ts`
- `dfkorea-backend/src/migrations/1787820400000-AllowMultipleDailyDispatchTimes.ts`
- `dfkorea-backend/src/migrations/1788135000000-AddTenderOpportunityType.ts`
- `dfkorea-backend/src/migrations/1788135100000-FixKaptSourceUrls.ts`
- `dfkorea-backend/test/tenders.contract-spec.ts`
- `dfkorea-backend/test/tender-app-integration.spec.ts`
- `DEPLOYMENT.md`

## 갱신 규칙

- 입찰 공고 메뉴의 조회, 필터, 상세, 수신 설정 기능을 변경할 때 이 문서를 같은 변경에서 갱신한다.
- 실제 입찰 API·메일 API 연동 상태가 바뀌면 `구현 완료`와 운영 한계 항목을 함께 조정한다.
- 캘린더 기준일, 수신 설정 범위, 공고 분류 표기를 변경하면 사용자에게 보이는 동작과 제한을 명시한다.

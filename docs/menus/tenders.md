# 입찰 공고

## 구현 완료

- G2B에서 거부한 첨부 URL, 파일명만 있는 첨부, 정규화할 수 없는 면허·지역·품목 행과 제공된 규격·수량·단위 값 및 잘못된 숫자 필드는 안전한 오류 코드와 건수로 남긴다. URL·키·원문 값은 진단에 복제하지 않는다. 실제로 비어 있는 선택 필드는 오류로 보지 않는다. 파서도 누락/읽기 실패 자료를 UNKNOWN으로 전달하여 사양이 100%여도 `참여 추천`이 되지 않으며, 유용한 자료가 남으면 PARTIAL이다.
- 사양과 필수 인증은 동일 제품 snapshot으로 평가한다. 각 후보의 최종 적합성(추천 → 검토 → 어려움)을 먼저 비교하고 같은 등급에서는 필수 인증 상태와 반올림 전 사양 점수로 선택한다. 인증 없는 100% 제품이나 비교 가능한 사양만 100%인 UNKNOWN 후보를 추가해도 인증·사양이 확인된 80% 추천 후보를 밀어내지 않는다. 명시적 미보유와 인증 정보 누락(UNKNOWN)을 구분하며 제품 식별자는 표시하지 않는다.
- 면허·기업구분·직접생산·인증 만료는 KST 날짜로 판정한다. 실제 결과가 달라지는 다음 만료 경계만 `eligibilityValidUntil`에 저장하고 매시 대기로 전환한다. 경계가 지난 상세/목록은 sweep 전에도 대기·미검토로 보이며 추천 배지를 숨긴다. 무관한 자격이나 여전히 유효한 OR 대안 때문에 매일 전체 분석을 무효화하지 않는다. 이전 분석기 결과도 즉시 stale로 표시하고 `rules-3`에서 다시 계산한다.
- 문서의 `기초금액의 98% 이상 102% 이하`는 절대 비율 98/102로 계산한다. `-2%/+2%`처럼 양쪽에 부호가 명시된 때만 100을 더하며, 절대값과 offset 혼합은 산식 확인 필요다. 공식 G2B 기초금액 API의 offset 계약은 유지한다.
- G2B 공식 공고명에 총액·원화/KRW·A값 미적용이 명시되고 국내 물품·단일 품목·적격심사·복수예가 방식이 함께 검증된 좁은 경우 실제 enrichment가 가격 context와 근거를 만든다. 저장된 최근 2년 낙찰 이력과 연결하여 공식 범위/15건 이상 통계를 계산한다. 총액·원화·A값 미적용은 각각 독립된 긍정 문구로 확인하며 `미적용 대상`은 허용하지만 `미적용 여부`, `미적용 가능`, 조건부·부정·상충 문구는 사실로 인정하지 않는다. 단가·외화·특수산식·A값 적용 여부 불명은 계속 보류한다.

- 입찰 적합성 분석은 나라장터(G2B) 물품 공고를 주 지원 대상으로 한다. 공식 공고 상세·기초금액·제한·구매품목·첨부와 낙찰정보서비스의 정규화된 최소 필드를 근거로 사용한다. K-apt는 공식 API와 같은 공고의 canonical 상세 페이지에서 직접 연결된 자료만 best effort로 처리하며, 확보하지 못한 가격·자격·첨부 값은 `확인 필요`로 남긴다. K-apt 값에 나라장터 산식을 대입하지 않는다.
- 상세 모달을 최대 1120px로 확장했다. 참여 상태·사양 충족도/분석 범위·인증·통계 예상가를 먼저 표시하고, 데스크톱은 왼쪽 조건/사양/인증/근거와 오른쪽 가격/문서 상태의 2열, 모바일은 1열로 배치한다. 공통 `BaseModal`, `BaseCard`, `BaseButton`을 사용한다.
- `참여 추천`, `검토 필요`, `참여 어려움`, 분석 대기/진행/부분/실패는 아이콘과 한국어 문구로 구분한다. 대기/진행/실패 때 이전 점수·추천을 현재 결과로 표시하지 않는다. 회사 프로필 미설정과 이전 검토의 무효화를 안내한다. 검토 완료와 2,000자 내부 메모 저장, 다시 분석, 공식 원문 링크를 제공한다.
- 사양 충족도에는 충족/불일치/사양 확인 필요 수와 비교 가능 범위를 병기한다. 자격·진단을 포함하는 전체 `unknownCount`와 사양 확인 필요 수는 분리한다. 서버가 상세를 생략했거나 표시 사양 수가 비교 가능 수보다 작으면 전체 분모 확인 필요로 표시한다. 인증 요구조건과 판정 ID가 일치하지 않거나 영역이 생략/축약되면 `전체 인증 수 확인 필요`와 표시된 일부 결과를 병기하여 전체 집계로 오인하지 않도록 한다. 필수 여부는 true/false만 필수/참고로 표시하고 null 또는 생략은 `필수 여부 확인 필요`로 남긴다. 납품실적은 최근 N년 이내와 최소 금액의 이상 조건을 함께 표시한다. 개별 사양 판정은 API가 제공하지 않아 요구값과 집계를 구분한다. 개별 사내 제품명·추천 목록·전체 추출 텍스트는 렌더링하지 않는다.
- 근거는 문서 식별/쪽·위치/차수와 320자 이하 텍스트로 표시한다. HTML로 해석하지 않으며 최대 80개 근거·10개 문서 상태만 표시한다. 공식 가격과 통계 가격을 구분하고 표본/기간/매칭 단계/신뢰도를 표시한다. 큰 금액과 소수 금액은 문자열 상태로 표시하여 정밀도를 유지한다.
- `회사 자격 설정`에서 회사 정보, 공급물품·면허·기업구분·직접생산·인증 반복 행과 유효기간, 납품실적을 편집한다. 코드·명칭 중복, 만료, 필수값, 실적 기간/금액을 검증하고 만료일 없음은 명시적으로 선택한다. 전체 PUT에 version을 넣지 않으며 저장 실패 시 초안을 보존한다. 닫기/재열기/공고 전환 뒤 오래된 GET/PUT/검토 응답은 화면에 반영하지 않는다.
- 목록의 백엔드 `analysis`를 클라이언트의 nullable `analysisSummary`로 정규화한다. 상세 재분석 결과는 페이지 새로고침 없이 목록 배지에 즉시 반영한다. 상세 진행 상태 및 회사 자격 저장 뒤 현재 목록은 진행 중일 때만 5초 간격으로 최대 30회 갱신하고, 완료/오류/모달 닫기/컴포넌트 종료 시 중단한다.

- 관련 공고 저장과 같은 트랜잭션에서 분석을 큐에 넣는다. 내용 fingerprint가 같은 재수집은 완료·검토 상태를 유지하고, 제목·조건·첨부를 포함한 공급자 내용 또는 분석기 버전 변경은 `PENDING`으로 전환한다. 수집 시각·분류 점수는 fingerprint에서 제외한다.
- 분석 작업은 PostgreSQL `FOR UPDATE SKIP LOCKED`, 임의 점유 token, 5분 lease로 하나씩 점유한다. 각 문서 전에 유효한 점유만 갱신하고, 최종 저장 시 token·lease·공고 fingerprint·프로필 버전·전체 제품 ID/updatedAt fingerprint를 다시 확인한다. 문서 저장도 같은 최종 트랜잭션 안에서 처리하여 이전 작업자가 새 결과를 덮어쓰지 못한다.
- 첨부는 문서별로 독립 처리하며 정규화된 문단/표, hash와 안전한 오류 코드만 보존한다. 유용한 사실이 있고 일부 출처가 실패하면 `PARTIAL`, 아무 사실도 확보하지 못한 출처 실패는 `FAILED`다. 동일 실패의 재분석이 완료 상태로 바뀌지 않으며 원본 bytes와 공급자 payload는 분석·문서 테이블에 저장하지 않는다.
- 관리자 JWT 아래 `GET/PUT /tenders/company-profile`, `GET /tenders/:id/analysis`, `POST /tenders/:id/analysis`, `POST /tenders/:id/review`, `POST /tenders/award-results/backfill`, `GET /tenders/award-results/status`를 연결했다. 분석 POST와 백필 POST는 명시적인 HTTP 202로 현재 작업 상태를 반환하며 문서 해석이나 공급자 수집을 기다리지 않는다.
- 회사 프로필 전체 교체는 version 증가와 모든 현재 분석의 대기 전환을 같은 트랜잭션에서 반영한다. 매시 전체 제품의 ID·updatedAt을 정렬한 fingerprint를 한 번 계산하여 제품 추가·수정·삭제 또는 분석기 버전 변경을 감지하고 일치하지 않는 분석을 대기 상태로 바꾼다.
- 리뷰는 화면에 표시된 64자리 `analysisFingerprint`, `completed` boolean과 0~2000자 `note`를 받는다. 행 잠금 아래 최신 fingerprint·만료 경계·분석 상태를 확인하고 다르면 409를 반환한다. 화면은 입력 메모와 충돌 안내를 보존하면서 최신 분석을 다시 불러온다. 클라이언트의 reviewer ID는 받지 않으며 인증된 Admin ID만 이력에 기록한다. 기존 검토 행은 보존하고 결과가 바뀌면 `reviewed: false`다.
- 상세 근거는 요구조건에 연결된 인용과 진단만 제공한다. 인용당 320자, 일반 출처는 요구조건당 후보 4개·품목당 12개, 전체 근거는 80개·JSON 48 KiB 상한이다. 자료 실패(`SOURCE_FAILURE`) 4개, 충돌(`CONFLICT`) 8개, 미해석 조건(`UNSUPPORTED`) 12개, 표시 생략(`TRUNCATION`) 4개의 독립 할당과 카테고리별 6 KiB 상한을 일반 출처보다 먼저 적용하므로 많은 일반 인용이 진단을 모두 밀어내지 못한다. 진단에는 `diagnosticCategory`가 추가되며 분석기가 만든 안전한 안내는 `source: ANALYSIS`로 구분한다. 동일 필드의 충돌도 관련 출처의 문서/위치·조건 의미를 정렬·해시한 64자리 `semanticId`로 먼저 정렬한다. 이 ID를 근거에 보존하여 관련 원문 인용이 생략된 뒤에도 저장/응답 순서가 동일하며, 오래된 참조는 불투명 ID 해시로 순서를 정한다. 완전히 같은 의미의 진단은 저장에 사용하는 정규화된 기록 ID로 최종 순서를 고정한다. 128자를 넘는 ID는 전체 값을 해시한 토큰으로 바꾸며, 기존 토큰은 다시 해시하지 않아 JSON 저장·재투영 후에도 순서가 유지된다. 여러 품목에 연결된 조건은 품목 키의 중복을 제거·정렬한 뒤 첫 키에 할당하여 입력 순서에 영향을 받지 않는다.
- 상세 요구조건·인증·참가·가격 JSON은 허용된 정규화 필드만 보존한다. 설명·인증명·조건명·예정가격/복수예비가격 방식은 320자, 식별자는 128자, 십진수 문자열은 64자, 배열은 80개, 각 JSON 영역은 16 KiB로 제한한다. 긴 설명은 말줄임표를 붙이고, 긴 식별자는 안정적인 SHA-256 토큰으로 치환하며, 긴 숫자는 잘못된 축약 숫자로 표시하지 않고 `null`로 둔다. 값·배열·필드가 생략되거나 정제되면 `TRUNCATION` 안내를 남긴다. 제어문자·방향 전환 문자를 제거하며 문서 표시명은 320자, 문서 식별자는 256자로 제한한다. 신규 결과는 저장 전에, 기존 결과는 응답 시 축약한다. 원래 정규화 문서는 `tender_documents`에만 보존하며 전체 문단·표 또는 공급자 bulk payload를 상세 JSON에 복제하지 않는다.
- 리뷰 fingerprint는 표시 상한 적용 **이전**의 모든 정규화 요구조건·자격·가격 결과와 모든 진단/관련 출처 식별 정보를 의미별로 해시한 `reviewSemanticDigest`를 포함한다. 전체 의미를 고정 길이 해시로 저장하므로 13번째 미해석 조건·80개 밖 진단·생략된 요구조건·320자 밖 산식 변경도 검토를 해제한다. 해시 기반 임시 ID·인용문 공백과 무관한 배열 순서는 제외하되 치수/지역 계층의 좌표 순서는 유지한다. 신규 nullable digest 컬럼은 기존의 축약 결과로 역산해 채우지 않는다. `rules-3` 버전 변경을 매시 큐 갱신에서 감지하여 원문으로 재분석하고, 이전 행은 그 전에도 stale로 표시한다. 기존 리뷰 이력은 유지하며 같은 점수라도 의미가 달라지면 `reviewed: false`다.

- 최종 결과 저장은 모든 잠금/문서 저장 대기 뒤 DB의 실제 현재 시각(`clock_timestamp()`)과 token·입력 fingerprint를 다시 비교하는 조건부 갱신을 사용한다. lease가 대기 중 만료되면 문서 교체와 카운터·결과 저장을 모두 rollback하고 다음 유효 작업자가 재점유한다.
- 목록의 `analysis`는 `{ status, suitability, specificationScore, unknownCount, analyzedAt }` 또는 null만 제공한다. 분석 상세는 조건·판정·근거 snippet과 문서별 상태를 제공하며 전체 추출 text/table block·점유 token·사내 제품명은 응답에 포함하지 않는다. comparable/satisfied/unsatisfied 수는 사양 기준이며 unknownCount는 사양·자격·미해석 근거·프로필 미설정·출처 실패 확인 항목을 포함한다.
- cron은 모두 `Asia/Seoul`, `noOverlap: true`를 적용한다. 기존 매시 정각 공고 수집과 매분 정각 메일/재시도를 유지하고, 매시 02분 10초 fingerprint 갱신 후 최대 5건 분석, 매분 20초 최대 2건 분석, 매일 02:15 낙찰 증분 수집, 매시 05~50분 중 5분 간격의 30초에 낙찰 백필/증분 1페이지 재개를 실행한다. 종료 시 7개 작업 모두 stop/destroy한다. 낙찰 작업은 일반 수집 advisory lock을 공유하며 정각을 피한다.

- 낙찰 이력 수집·가격 분석 기반 서비스: 공식 물품 최종낙찰 목록과 예비가격·물품 공고를 연결하며 금액을 decimal string으로 보존한다. 최근 2년의 KST 월별 구간과 DB lease/cursor로 중단 후 재개하며, 완료된 연속 구간의 마지막 날짜부터 7일을 겹쳐 누락 기간을 월별로 보충한다. 일반 수집 lock이 사용 중이면 건너뛴다. 한 tick에 목록 1페이지와 LED 후보 1건의 상세 조회만 처리한다.
- 투찰 가격 계산은 명시된 총액·통화·산식 정보를 요구하며 BigInt 유리수 연산으로 계산한다. 통계는 최근 2년·동일 방식의 유효 결과에 IQR 제거, 세부품명/지역 → 세부품명 → LED 제품군 순서의 fallback, 15/30/100건 신뢰도 경계를 적용한다.

- 입찰 첨부문서 추출의 독립 백엔드 어댑터를 구현했다. HWP 5.x/HWPX/PDF/DOCX/XLSX를 메모리에서 읽어 순번·쪽/섹션/sheet 위치가 있는 문단·표 블록으로 변환한다. 암호화, 손상, OCR 필요, 미지원, 크기·압축·시간 제한은 안전한 오류 코드로 반환하며 원본·파서 오류 본문을 저장하거나 로그에 남기지 않는다. 실제 분석 작업과 관리자 상세 문서 상태 화면에 연결했다.

- 관리자 좌측 메뉴의 `입찰 공고` 탭에서 등록일 기준 월간 공고를 조회한다.
- 캘린더는 이전·다음 달 날짜를 포함한 7열 × 6주, 총 42개 셀을 항상 표시한다.
- 월간 전체·💡 직접 관련·⚡ 잠재 관련 건수와 일자별 건수를 표시하고, 날짜를 선택하면 해당 날짜의 목록을 페이지 단위로 조회한다.
- 필터는 검색어, 출처, 지역, 공고 유형, 관련도만 제공하며 공고 목록과 월간 캘린더 집계에만 적용된다.
- 지역은 입력 문자열을 포함하는 부분 검색이며 `%`, `_`, `!`는 일반 문자로 안전하게 처리한다.
- 수신 설정은 최대 20개 이메일 주소와 공통 발송 시각만 입력받으며 캘린더 필터를 포함하지 않는다. 수신 주소가 있는 설정을 저장하면 메일 수신이 자동으로 시작되고, 중지는 별도의 `메일 수신 중지` 버튼으로만 수행해 주소·시각을 유지한다.
- 공고 상세는 출처·기관·등록/마감 일시·분류 근거와 안전한 공식 원문 링크를 제공한다.
- 목록과 상세의 등록·마감 일시는 `Asia/Seoul`로 일관되게 표시하고, 큰 추정 금액은 bigint 정밀도를 유지한다.
- 백엔드는 나라장터·K-apt 공식 API 어댑터와 비활성화된 한전 어댑터, 판정 근거 저장, 등록일(KST) 기준 조회, NAVER WORKS Mail API(HTTPS/OAuth), 수신 주소별 영속 메일 재시도 계약을 구현했다.
- 나라장터는 회사가 참여할 수 있는 물품 공고만 수집·표시·메일 발송한다. K-apt는 기존 범위를 유지하여 물품·공사 여부와 관계없이 직접·잠재 LED 관련 공고를 계속 처리하고, 한전의 기존 동작도 변경하지 않는다.
- 운영 DB에 이미 저장된 나라장터 공사·용역 공고는 이력 보존을 위해 삭제하지 않지만 캘린더 집계·목록·상세·신규 메일·메일 재시도에서 제외한다.
- 나라장터는 물품 operation `getBidPblancListInfoThng`에만 `type=json`과 KST `YYYYMMDDHHmm` 등록 범위를 사용하며, 응답의 실제 첨부파일명도 분류 입력에 포함한다.
- 나라장터는 Railway 직접 수집을 우선한다. HTTP 200이지만 결과 코드가 없는 안전하지 않은 응답만 작업 단위로 Vercel 보안 릴레이를 통해 재시도하므로, 정상 직접 수집 건을 중복 요청하지 않는다.
- 나라장터 등록일 조회 시각은 KST 12자리 형식으로 만들며, Railway Node 20 Alpine ICU가 자정을 `24:00`으로 반환하는 경우 G2B가 허용하는 `00:00`으로 정규화한다.
- Vercel 릴레이는 나라장터 물품 작업 `getBidPblancListInfoThng`과 고정된 한 페이지 쿼리만 허용하며 공사·용역 요청은 거부한다. Railway 직접 수집은 Railway 서버 전용 `PUBLIC_DATA_SERVICE_KEY`를 사용하고, 릴레이 요청에는 `serviceKey`를 넣지 않는다. Vercel은 Railway 키의 같은 값을 Vercel 서버 전용 `G2B_DATA_SERVICE_KEY`로 복사해 릴레이 upstream 호출에만 붙인다.
- Vercel 릴레이의 upstream은 `https://apis.data.go.kr/1230000/ad/BidPublicInfoService` 공식 경계만 허용하고 자동 리다이렉트를 거부한다. 공공데이터포털이 반환한 4xx·5xx 상태는 본문을 읽거나 노출하지 않은 채 그대로 백엔드에 전달하므로, 영구 4xx는 한 번만 시도하고 기존 일시 오류 상태만 제한적으로 재시도한다. 프로덕션 빌드는 `/api/internal/g2b-relay`가 Nitro 서버 산출물에 실제 등록됐는지 검사하며 누락되면 배포 빌드를 실패시킨다.
- K-apt 신규 공고의 공식 원문은 현재 상세 경로인 `https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=...`로 저장한다. 기존 `/web/bid/bidDetail.do` 링크는 데이터 마이그레이션으로 K-apt 행의 `sourceUrl`만 비파괴적으로 보정하며 공고·수집·메일 이력은 유지한다.
- 수신 주소를 제거하면 비활성화하고, 다시 추가하면 같은 ID와 발송 이력을 복원한다. 설정 모달은 열 때마다 새 세대로 최신값을 조회하고, 늦게 도착한 이전 요청은 상태를 덮어쓰지 못한다. 최신 조회 실패 상태에서는 저장할 수 없으며 모달 안의 `다시 시도`로 새 요청을 실행한다.
- 수집은 `Asia/Seoul` 기준 매시 정각에 예약된다. 관리자는 필터 왼쪽의 `즉시 수집` 버튼으로 같은 수집 파이프라인을 실행할 수 있고, 완료 후 현재 월 캘린더와 선택 날짜 목록이 갱신된다. 정기·수동 수집이 겹치면 PostgreSQL advisory lock으로 중복 실행을 막는다. 나라장터 물품 수집과 K-apt 수집은 출처별로 독립 처리하므로 한 출처가 실패해도 다른 출처의 성공 공고는 반영한다. 일시적인 나라장터 제한·네트워크 오류는 수집 중 제한적으로 재시도하고 복구되지 않으면 다음 정기·수동 수집에서 다시 조회한다. 메일은 매분 공용 설정을 다시 읽고 KST 날짜·설정 시각 고유 claim과 PostgreSQL advisory lock으로 같은 시각의 중복 실행을 막는다. 같은 날 공용 발송 시각을 변경하면 새 슬롯으로 다시 발송할 수 있다.
- display-only `LED전광판`/`LED 전광판`/`LED디스플레이`/`LED 디스플레이`는 대소문자와 공백 수에 관계없이 일반 LED 근거를 제외한다. display phrase가 공고 어디든 있으면 다른 필드의 bare `LED`도 독립 근거로 보지 않으며, `가로등`·`조명`·`등기구`·`보안등` 같은 구체 조명 근거가 있어야 직접 관련으로 유지한다.
- 발송 슬롯 claim은 15분 lease를 사용한다. 각 delivery는 `(dailyDispatchId, recipientId)` 고유 identity를 기록한다. recipient delivery를 만들기 전 DB 오류가 나면 완료하지 않고 stale lease에서 재개한다. 새 설정 시각 슬롯에서는 이미 `SENT`인 공고를 제외하며, 이전 슬롯의 `DELIVERY_UNCERTAIN` 공고는 다시 발송 대상으로 전환한다.
- NAVER WORKS OAuth 시작·연결 상태 API는 관리자 JWT로 보호하고, callback은 10분 유효 SHA-256 state 검증 후에만 토큰을 저장한다. access/refresh token은 배포 secret의 32-byte key로 AES-256-GCM 암호화해 DB에 저장하고, 만료 전 자동 갱신한다.
- 수신 설정 모달에서 NAVER WORKS 연결 상태를 확인하고 최초 연결 또는 재연결을 시작할 수 있다. backend가 반환한 공식 `https://auth.worksmobile.com` URL만 허용하며, OAuth callback 뒤에는 연결 상태를 다시 조회하고 완료 안내를 표시한다.
- 메일은 수신 주소마다 NAVER WORKS HTTPS Mail API를 개별 호출해 주소 상호 노출을 막는다. `202 Accepted`만 성공으로 확정하고, `401`은 토큰을 한 번 강제 갱신한 뒤 같은 호출을 다시 시도한다.

## 미구현

- 이미지 전용 PDF와 첨부 이미지에 대한 OCR은 제공하지 않는다. 해당 문서는 `DOCUMENT_OCR_REQUIRED` 또는 부분 분석으로 표시하며 관리자가 공식 원문을 확인한다.
- 낙찰 이력 백필 시작 및 전체 수집 상태를 조작하는 관리자 화면은 아직 제공하지 않는다.

- 낙찰정보서비스의 인증·설정 오류 재개는 내부 `resumeTerminalFailures()` 서비스 호출을 제공하며 공개 관리자 API는 아직 연결하지 않았다.

- 입찰 공고의 관리자 수동 등록·수정·삭제 기능은 제공하지 않는다.
- 공고 마감 임박 알림 또는 별도 마감 임박 표시는 제공하지 않는다.
- 수신 주소별 독립 필터·독립 발송 시각은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 실제 가격 표시는 공급자 응답에서 검증된 총액/통화/낙찰 방식/산식 metadata를 확보하고, 낙찰정보서비스 공개 corpus가 동일 기준의 최종 낙찰로 보수적 필터를 통과할 때만 가능하다. G2B 물품 공식 스키마에는 총액/통화/A값 적용 여부 전용 필드가 없어 공식 공고명의 명시적 선언으로 검증하는 제한된 경로만 지원한다. 해당 문구가 없는 공고는 `FORMULA_REVIEW_REQUIRED` 또는 `INCOMPARABLE_CONTRACT`로 남는다. 가격 fixture는 공식 필드 구조를 따르는 합성 예제이며 실공고에서의 가용성을 증명하지 않는다. 공개 corpus도 입찰 분류 식별자·단가/총액·지역 필드가 제한되어 많은 결과가 제외되며, 통계는 15개 미만이면 제공하지 않는다.
- 운영 전 기존 `PUBLIC_DATA_SERVICE_KEY`에 나라장터 낙찰정보서비스 `ScsbidInfoService`의 별도 활용 승인이 필요하다. 별도 secret이나 필수 환경변수는 없고 공식 base URL이 내장되어 있으며, `G2B_AWARD_API_BASE_URL`은 선택 override다. migration과 애플리케이션을 먼저 배포하고 health 및 실제 나라장터 분석 한 건을 확인한 뒤 관리자가 백필을 시작·모니터링해야 한다.
- 회사 자격 PUT 응답에는 전체 무효화 건수가 없다. 화면은 실제 조회한 현재 날짜·페이지의 재계산 건수만 표시하며 전체 처리 완료로 표현하지 않는다. 다른 날짜/페이지는 해당 목록을 열어 확인한다. 자동 갱신이 30회 후 중단되면 상세의 진행 상태 확인 또는 목록 재조회를 이용한다.
- 화면 동작은 명시적인 테스트 fixture로 검증한다. 실제 운영 공고의 공개 문서, 실운영 키/로그인 환경에서의 분석 품질 검증을 대신하지 않는다. 개별 사양 충족 판정은 상세 API에 없으므로 요구 사양 표는 요구값만 표시하며 위쪽 집계로 판정을 확인한다.

- 회사 프로필이 없으면 회사 자격을 미보유로 단정하지 않고 UNKNOWN으로 표시한다. 제품 DB에 없는 IP 등급·조달 분류의 추정 매핑은 하지 않으며 현재 등록된 수치·인증만 사용한다. 개별 제품명·매칭 목록은 제공하지 않는다.
- 한 분석은 최대 10개 첨부를 처리하며 초과 문서는 출처 확인 필요로 남겨 PARTIAL/FAILED 상태에 반영한다. 실패 작업은 수동 재분석 또는 입력 변경으로 다시 실행한다. 제품 변경 감지는 매시, 기존 공고의 자동 큐 생성은 재수집 시 반영된다. 개찰 이력 갱신 자체는 자동 재분석 트리거가 없으므로 최신 가격 검토 시 수동 재분석이 필요하다. 자격 expiresAt 만료는 자동 경계 감지 대상이며, 상대기간 납품실적의 일별 재평가는 별도 후속 작업이다.
- `1788699100000-FixTenderReviewAdminIdentity`는 미출시 분석 스키마의 reviewerAdminId UUID를 기존 Admin.id에 맞는 integer로 보정한다. 기존 값이 하나라도 있으면 up/down 모두 중단하여 이력을 버리지 않는다. 운영 적용 전 리뷰가 없는 스키마라는 전제를 확인해야 한다.

- 분석 상세·회사 자격·리뷰·가격 관리자 UI를 구현했다. 낙찰 백필 시작/전체 상태 관리자 UI는 후속 작업이다. 낙찰 시작/상태 API와 cron은 연결했다. 공식 Swagger 필드 전체를 포함한 익명 fixture와 독립 로컬 PostgreSQL로 검증했으며, 승인된 운영 key로 응답 검증은 아직 하지 않았다.
- 최종 목록에서 관측된 기존 공고는 제목이 LED에서 다른 품목으로 바뀌어도 DB의 공고 식별자를 기준으로 재확인한다. 같은 공고·차수의 명시적인 취소/유찰/재입찰은 과거 이력을 무효화하고, 단일 품목 재분류는 결과 upsert·cursor와 동일한 lease 검증 transaction에서 반영한다. 누락 응답·요청 실패·모호한 join은 무효화 근거로 쓰지 않는다.
- 저장 스키마에 `bidClsfcNo`가 없어 여러 입찰 분류/기존 품목이 함께 있으면 과거 품목과 현재 분류를 추측해 연결하지 않는다. 같은 저장 키로 합쳐지는 서로 다른 분류는 페이지·offset에 관계없이 저장에서 제외하며 기존 금액을 덮어쓰지 않는다. 관련 없는 이력을 유지하고 `AMBIGUOUS_CLASS_IDENTITY` 진단을 노출하므로 통계 활용 전 검토가 필요하다. 물품 join은 공고·차수·입찰분류와 제공된 재입찰 번호가 일치해야 한다.
- 상세·물품·예비가격 응답은 전체 건수와 반환 건수, 모든 공고·차수 식별자가 완전해야 취소/단일 품목 조정에 사용한다. 불완전하면 `INCOMPLETE_AWARD_EVIDENCE`를 남기고 기존 이력을 무효화하지 않는다. 검토 진단은 후속 정상 페이지·재시작·완료·일시 오류에도 유지된다. 운영 검토 후 내부 `resetReconciliationDiagnostics(runId)`로 명시적으로 해제하며 실행 중인 lease와 공급자 실패 상태는 해제하지 않는다. `resumeTerminalFailures()`는 인증/설정 수정 후 실패 및 해당 검토 진단을 명시적으로 재설정한다. 공개 운영 API는 후속 작업이다.
- 인증·구독 거절 등 terminal 오류는 `FAILED`와 제한된 `TERMINAL_*` 코드로 영속화하고 같은 서비스의 수집을 멈춘다. 운영자가 원인을 수정한 후 명시적으로 재개해야 하며, 네트워크·429·5xx 같은 일시 오류만 cooldown 후 재시도한다.
- 공식 낙찰/물품 응답에 단가·총액 구분 필드가 없으므로 동일 공고 제목에 `총액`이 명시되고 국내 입찰이며 단일 LED 품목인 경우만 저장한다. 명시가 없는 많은 정상 결과도 보수적으로 제외한다. 현재 수집 이력은 지역이 null이므로 세부품명+방식 단계부터 비교하며 지역별 근거 연계는 후속 개선이다.
- 백필 기간은 DB date와 provider 분 단위 조회에 맞춘 KST 양끝 날짜 포함 구간이다. 현재 날짜의 증분 결과는 다음 수집의 연속 완료 watermark와 7일 겹침 구간에서 다시 확인한다. 수집 중단이나 백필 지연이 7일을 넘더라도 중간 날짜를 건너뛰지 않는다. 목록 page+offset 재개는 provider 목록 순서가 안정적인 범위에서 동작하며 변경 중인 당일 목록은 다음 겹침 수집으로 보완한다.

- 문서 추출은 직접 생성한 유효 형식 fixture와 내부 손상·제한 계약으로 검증했다. 분석 파이프라인은 연결했지만 운영 공고의 공개 문서 표본 검증은 아직 수행하지 않았다. PDF 표는 텍스트 기준선과 반복된 열 정렬을 이용한 추정이며 OCR·복잡한 다단 편집·병합 셀의 시각 배치를 재구성하지 않는다. 이미지 전용 PDF는 `DOCUMENT_OCR_REQUIRED`, 일부 빈/이미지 쪽은 `PARTIAL`이다.
- 추출기는 20 MiB 입력, 10 MiB 출력 텍스트, 15초 worker 종료, ZIP/CFB entry 4,096개, 전체 압축 해제 40 MiB와 100:1 압축비 제한을 적용한다. HWP 원본 CFB는 외부 파서로 읽지 않고 제한된 리더가 헤더·DIFAT/FAT/miniFAT·디렉터리와 모든 도달 가능한 스트림의 순환·중첩·선언/실제 체인 크기를 먼저 검증한다. 스트림 메모리는 전체 검증이 끝난 뒤 할당하며 외부 HWP 파서에는 다시 작성한 비압축 컨테이너만 전달한다. XML은 문자열·AST를 만들기 전 원본 XML 합계도 10 MiB로 제한하며 DTD/사용자 entity를 거부하므로 큰 서식 정보가 있는 문서는 텍스트가 작아도 제한될 수 있다. PDF는 직접 stream length와 단일 Flate 필터(`/F` 별칭 포함)를 사전 검증하고 중복·충돌하는 필터 선언을 거부하며 간접 길이·복합/미지원 필터는 `DOCUMENT_UNSUPPORTED`로 남긴다.
- HWP의 본문 밖 머리말·각주·도형, 중첩 표 및 DOCX의 복잡한 병합·비텍스트 구성은 완전한 해석 범위가 아니다. DOCX는 각주·미주 참조와 run·hyperlink 아래의 이미지도 검사하여 생략한 내용이 있으면 `PARTIAL`로 표시하고 문단·표 셀의 탭 단어 경계는 보존한다. XLSX는 계산을 실행하지 않고 저장된 formula 결과와 표시 형식을 사용하며 결과 cache가 없으면 `PARTIAL`이다. 숨김 sheet는 metadata에 명시하고 내용도 근거에 포함한다.

- 나라장터·K-apt는 공식 응답 fixture와 어댑터 계약 테스트만 통과했다. 공공데이터포털에서 승인된 실운영 키로 실제 응답을 받은 검증은 아직 하지 않았다.
- K-apt canonical 상세 경로는 실공고 표본에서 HTTP 200 응답을 확인했지만, 공고별 게시 종료·삭제와 외부 사이트의 향후 경로 변경까지 애플리케이션이 보장할 수는 없다. 배포 후 운영 공고 표본의 `공식 원문 열기`를 주기적으로 확인해야 한다.
- 한전은 LINK API의 승인 계정·실제 OpenAPI 매뉴얼이 없어 기록 계약 fixture만 사용한다. `KEPCO_TENDER_ENABLED=false`가 기본이며, 실제 base URL·인증 파라미터·필드 매핑 검증 전에는 활성화하면 안 된다.
- 릴레이는 Railway의 특정 HTTP 200 응답 이상을 우회하기 위한 보조 경로다. 릴레이에서도 공공데이터포털 응답이 차단되면 파싱 규칙을 완화하지 않고, 허용된 고정 outbound 주소를 갖춘 별도 국내 호스팅 수집기를 마련해야 한다.
- 릴레이 작업 실패 로그에는 응답 원문 대신 `GATEWAY_ERROR_SHAPE`, `UNKNOWN_RESPONSE_SHAPE` 같은 제한된 형태 분류만 기록한다.
- Railway 운영 환경에는 `PUBLIC_DATA_SERVICE_KEY`, `G2B_RELAY_ENABLED`, `G2B_RELAY_URL`, `G2B_RELAY_SHARED_SECRET`가 필요하다. Vercel 운영 환경에는 동일한 `G2B_RELAY_SHARED_SECRET`과 `G2B_TENDER_API_BASE_URL`, `G2B_DATA_SERVICE_KEY`가 필요하며, 모두 서버 전용 변수로 설정해야 한다. Vercel의 `G2B_DATA_SERVICE_KEY` 값은 Railway의 `PUBLIC_DATA_SERVICE_KEY`에서 복사하되 릴레이 요청에는 포함하지 않는다.
- NAVER WORKS Mail API는 전송기 이중(mock)과 OAuth 암호화·갱신 및 영속 재시도 계약까지 검증했다. 스테이징에서 실제 Developer Console 앱의 `mail` scope, callback, 발신 계정 승인, `202` 성공, 주소 비중복, `429`/토큰 endpoint 일시 실패의 10분 후 1회 재시도를 확인해야 한다.
- Mail API의 `429`처럼 수신이 명시적으로 거절된 일시 오류만 같은 슬롯에서 10분 뒤 한 번 재시도한다. `401`은 access token을 한 번 갱신하며, 그 밖의 `4xx`는 영구 실패다. Mail API는 idempotency key를 제공하지 않으므로 발송 요청의 network/timeout 오류와 `5xx`는 제공자가 이미 승인했을 가능성을 배제할 수 없어 해당 슬롯에서는 `DELIVERY_UNCERTAIN`으로 종결한다. 이후 관리자가 같은 날 발송 시각을 변경하거나 다음 날짜 슬롯이 열리면 이 공고는 다시 발송될 수 있으므로 드문 경우 중복 메일 가능성이 있다.
- 빠른 HTTP·서비스 계약 테스트와 화면 테스트는 안전한 이중(mock)을 사용한다. 별도 로컬 disposable PostgreSQL에서 `test:tender:integration`을 실행해 실제 AppModule, JWT, TypeORM, migration 흐름 6개 테스트를 모두 통과했다. 이 파괴적 러너는 로컬/명시 Docker 테스트 DB만 허용하며 원격 스테이징 DB에는 실행할 수 없다. 승인된 실운영 키의 공공 API 응답, 운영 공개 문서 corpus, 실제 배포 환경의 인증 E2E와 대량 데이터 동작은 아직 검증하지 않았다.
- 이미 운영 DB에 적용된 `opportunityType`·`opportunityReasons` 컬럼은 기존 데이터와 마이그레이션 이력을 보호하기 위해 삭제하지 않는다. 현재 애플리케이션은 이 레거시 컬럼을 조회·메일 대상 제한에 사용하지 않는다.

## 관련 파일

- `dfkorea-backend/.env.example`
- `database-schema.md`
- `dfkorea-backend/src/tenders/services/tender-analysis.service.ts`
- `dfkorea-backend/src/tenders/services/tender-analysis-queue.ts`
- `dfkorea-backend/src/tenders/services/tender-analysis-evidence.ts`
- `dfkorea-backend/src/tenders/services/tender-analysis-detail.ts`
- `dfkorea-backend/src/migrations/1788699200000-AddTenderReviewSemanticDigest.ts`
- `dfkorea-backend/src/migrations/1788699300000-AddTenderEligibilityValidity.ts`
- `dfkorea-backend/src/tenders/domain/tender-calendar-date.ts`
- `dfkorea-backend/src/tenders/adapters/fixtures/g2b-enrichment-pricing.md`
- `dfkorea-backend/src/tenders/dto/tender-analysis.dto.ts`
- `dfkorea-backend/src/tenders/services/tender-company-profile.service.ts`
- `dfkorea-backend/src/tenders/services/tender-scheduler.service.ts`
- `dfkorea-backend/src/migrations/1788699100000-FixTenderReviewAdminIdentity.ts`
- `dfkorea-backend/test/tender-app-integration.spec.ts`

- `dfkorea-backend/src/tenders/adapters/g2b-award.adapter.ts`
- `dfkorea-backend/src/tenders/services/tender-award-collector.service.ts`
- `dfkorea-backend/src/tenders/domain/tender-price-analyzer.ts`

- `dfkorea-backend/src/tenders/documents/tender-document-extractor.ts`
- `dfkorea-backend/src/tenders/documents/tender-document-extraction.worker.ts`
- `dfkorea-backend/src/tenders/documents/extractors/`
- `dfkorea-backend/src/tenders/documents/fixtures/`

- `led-lighting-website/src/views/admin/AdminDashboard.vue`
- `led-lighting-website/src/components/admin/TenderManagement.vue`
- `led-lighting-website/src/components/admin/tenders/`
- `led-lighting-website/src/api/tenders.ts`
- `led-lighting-website/src/types/tender.ts`
- `led-lighting-website/src/utils/tender-calendar.ts`
- `led-lighting-website/src/utils/tender-analysis-display.ts`
- `dfkorea-backend/src/tenders/`
- `dfkorea-backend/src/tenders/domain/tender-visibility.ts`
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

- 입찰 공고 메뉴의 조회, 필터, 상세 분석, 회사 자격, 검토, 진행 상태 갱신, 수신 설정 기능을 변경할 때 이 문서를 같은 변경에서 갱신한다.
- 실제 입찰 API·메일 API 연동 상태가 바뀌면 `구현 완료`와 운영 한계 항목을 함께 조정한다.
- 나라장터/K-apt 지원 범위, 낙찰 공개 corpus·pricing metadata 가용성, OCR 지원 여부, 낙찰정보서비스 승인 또는 백필 운영 절차가 바뀌면 `DEPLOYMENT.md`, `.env.example`, `database-schema.md`와 이 문서를 함께 검토한다.
- 캘린더 기준일, 수신 설정 범위, 공고 분류 표기를 변경하면 사용자에게 보이는 동작과 제한을 명시한다.
